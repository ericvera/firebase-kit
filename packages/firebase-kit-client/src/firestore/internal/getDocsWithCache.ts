import type { DocumentData } from 'firebase/firestore/lite'
import {
  createStore,
  delMany,
  entries,
  GetSetDelResetError,
  setMany,
} from 'getsetdel'
import { ConnectivityError } from '../../connectivity/index.js'
import { FirestoreVariant } from '../constants.js'
import { reviveTimestamps } from '../reviveTimestamps.js'
import type {
  CachedDocument,
  FirestoreTimestamp,
  FirestoreUtilsDependencies,
  GetDocsWithCacheOptions,
  WithID,
} from '../types.js'
import { mergeDocumentsById } from './mergeDocumentsById.js'
import { trackLatestDocumentTimestamp } from './trackLatestDocumentTimestamp.js'
import { trackOldestCacheTime } from './trackOldestCacheTime.js'

export const createGetDocsWithCache = (
  dependencies: FirestoreUtilsDependencies,
) => {
  /**
   * Fetches and caches a Firestore collection with incremental updates.
   *
   * Use this for collections that you query repeatedly and want to reduce
   * Firestore reads. Supports incremental updates using document timestamps
   * to only fetch new/changed documents.
   *
   * @template DBT - The Firestore document data type
   * @template T - The type of documents in the collection with id field
   * @param options - Configuration for fetching and caching the collection
   * @returns Array of documents from the collection
   */
  const getDocsWithCache = async <
    DBT extends DocumentData,
    T extends WithID<DBT> = WithID<DBT>,
  >(
    options: GetDocsWithCacheOptions<DBT, T>,
  ): Promise<T[]> => {
    // Perform up to 3 attempts with exponential backoff
    for (let i = 0; i < 3; i++) {
      try {
        const { name, version, tags, key } = options

        // - Initialize store with the key (e.g. an owning entity id)
        const storeToken = await createStore({
          name,
          version: (version ?? 0) + dependencies.cacheVersion,
          ...(tags === undefined ? {} : { tags }),
          ...(key === undefined ? {} : { key }),
        })

        // - Load cached documents from the store
        const cachedEntries = await entries<CachedDocument<DBT>>(storeToken)
        const cachedDocuments: T[] = []
        const itemsToRemove: string[] = []

        // Process cached entries
        let latestDocumentTimestamp: FirestoreTimestamp | undefined
        let oldestCachedAt: number | undefined

        for (const [docId, cachedDoc] of cachedEntries) {
          const revivedData = await reviveTimestamps(
            cachedDoc,
            FirestoreVariant.FirestoreLite,
          )

          const document = {
            id: docId,
            ...revivedData.data,
          } as T

          // Check if item should be removed
          if (options.shouldRemove?.(document)) {
            itemsToRemove.push(docId)
          } else {
            cachedDocuments.push(document)

            // Track latest document timestamp for incremental queries
            latestDocumentTimestamp = trackLatestDocumentTimestamp(
              latestDocumentTimestamp,
              revivedData.data,
              options.syncProp,
            )

            // Track oldest cache time for refresh decision
            oldestCachedAt = trackOldestCacheTime(
              oldestCachedAt,
              revivedData.meta.cachedAt,
            )
          }
        }

        // Remove items from cache if needed
        if (itemsToRemove.length > 0) {
          await delMany(storeToken, itemsToRemove)
        }

        // Quick offline check — avoid network calls entirely. Surfacing the
        // offline state to the user is the app's job, not this layer's.
        if (!navigator.onLine && !options.inEmulator) {
          return cachedDocuments
        }

        // If we have cached data, check if we should refresh
        if (
          cachedDocuments.length > 0 &&
          options.shouldRefresh !== undefined &&
          !options.shouldRefresh(oldestCachedAt)
        ) {
          return cachedDocuments
        }

        // Attempt network fetch with connectivity handling
        try {
          const documents = await dependencies.withConnectivityHandling(
            async () => {
              const { getDocs } = await import('firebase/firestore/lite')

              // Use warmupQuery for initial load if provided and cache is empty
              const query =
                !latestDocumentTimestamp && options.warmupQuery
                  ? await options.warmupQuery()
                  : await options.getQuery(latestDocumentTimestamp)

              const querySnapshot = await getDocs(query)

              return querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as T[]
            },
          )

          // Filter out documents to remove, and track which ones they are
          // from cache
          const filteredDocuments: T[] = []
          const additionalItemsToRemove: string[] = []

          for (const doc of documents) {
            if (options.shouldRemove?.(doc)) {
              // Document should be removed - add to removal list for cache
              // cleanup
              additionalItemsToRemove.push(doc.id)
            } else {
              // Document is valid - keep it
              filteredDocuments.push(doc)
            }
          }

          // Remove items from cache that came back from query but should be
          // removed
          if (additionalItemsToRemove.length > 0) {
            await delMany(storeToken, additionalItemsToRemove)
          }

          // Cache new documents (only those not filtered out)
          if (filteredDocuments.length > 0) {
            const currentTime = Date.now()
            const cacheEntries: [string, CachedDocument<DBT>][] =
              filteredDocuments.map((doc) => {
                const { id, ...dataWithoutId } = doc

                const cacheItem: CachedDocument<DBT> = {
                  data: dataWithoutId as unknown as DBT,
                  meta: {
                    cachedAt: currentTime,
                  },
                }

                return [id, cacheItem]
              })

            await setMany(storeToken, cacheEntries)
          }

          // Return merged result — new documents win over cached ones
          return mergeDocumentsById(cachedDocuments, filteredDocuments)
        } catch (error) {
          // Handle connectivity errors by falling back to cache
          if (error instanceof ConnectivityError) {
            if (cachedDocuments.length > 0) {
              return cachedDocuments
            }
            // No cache available - re-throw the connectivity error
            throw error
          }

          // Fatal error - propagate
          throw error
        }
      } catch (error) {
        if (!(error instanceof GetSetDelResetError)) {
          throw error
        }

        // Add exponential backoff for store reset errors
        await new Promise((resolve) => setTimeout(resolve, 2 ** i * 1000))
      }
    }

    throw new Error('Failed to get and cache docs after 3 attempts')
  }

  return getDocsWithCache
}
