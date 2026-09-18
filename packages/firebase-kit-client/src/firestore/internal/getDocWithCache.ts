import type { DocumentData } from 'firebase/firestore/lite'
import { createStore, del, get, set } from 'getsetdel'
import { FirestoreVariant } from '../constants.js'
import { reviveTimestamps } from '../reviveTimestamps.js'
import type {
  CachedDocument,
  FirestoreUtilsDependencies,
  GetDocWithCacheOptions,
  WithID,
} from '../types.js'
import { readThroughCache } from './readThroughCache.js'

export const createGetDocWithCache = (
  dependencies: FirestoreUtilsDependencies,
) => {
  /**
   * Fetches and caches a single Firestore document with offline support.
   *
   * Use this for documents that don't change frequently and when you want
   * to reduce Firestore reads. Automatically handles cache refresh based
   * on your shouldRefresh logic.
   *
   * A Firestore-document adapter over readThroughCache. The cache-aside
   * sequence (serve fresh, serve stale on connectivity/offline, refresh on
   * success) lives there, and this only supplies how to open the store and how
   * to read/fetch/write/drop a single doc.
   *
   * @template DBT - The Firestore document data type
   * @template T - The type of the document with id field
   * @param options - Configuration for fetching and caching the document
   * @returns The document data or undefined if not found
   */
  const getDocWithCache = async <
    DBT extends DocumentData,
    T extends WithID<DBT> = WithID<DBT>,
  >(
    options: GetDocWithCacheOptions<DBT>,
  ): Promise<T | undefined> => {
    const { name, version, tags } = options

    return readThroughCache<T>({
      isOnline: navigator.onLine || !!options.inEmulator,

      // Rebuilt on every call rather than captured, so each attempt hands the
      // closures below a token the current store matches.
      openStore: () =>
        createStore({
          name,
          version: (version ?? 0) + dependencies.cacheVersion,
          ...(tags === undefined ? {} : { tags }),
        }),

      readCache: async (storeToken) => {
        const cachedEntry = await get<CachedDocument<DBT>>(
          storeToken,
          options.id,
        )

        if (!cachedEntry) {
          return undefined
        }

        const revived = await reviveTimestamps(
          cachedEntry,
          FirestoreVariant.FirestoreLite,
        )

        return {
          value: { id: options.id, ...revived.data } as T,
          // No refresh policy → always stale, so we refresh when online.
          fresh:
            options.shouldRefresh !== undefined &&
            !options.shouldRefresh(revived),
        }
      },

      fetch: () =>
        dependencies.withConnectivityHandling(async () => {
          // No need to revive timestamps as the Firestore lib takes care of it.
          const { getDoc } = await import('firebase/firestore/lite')

          const dataSnapshot = await getDoc(await options.getRef(options.id))
          const data = dataSnapshot.data()

          return data === undefined
            ? undefined
            : ({ id: options.id, ...data } as T)
        }),

      writeCache: async (storeToken, value) => {
        // The id is the cache key, not part of the stored document data.
        const { id, ...data } = value

        await set(storeToken, options.id, {
          data: data as unknown as DBT,
          meta: { cachedAt: Date.now() },
        })
      },

      dropCache: (storeToken) => del(storeToken, options.id),
    })
  }

  return getDocWithCache
}
