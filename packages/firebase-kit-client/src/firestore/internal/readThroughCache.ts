import { GetSetDelResetError } from 'getsetdel'
import {
  ConnectionStatus,
  ConnectivityError,
} from '../../connectivity/index.js'

/**
 * A cached value paired with whether it is still fresh enough to serve without
 * refetching.
 */
interface CachedValue<T> {
  value: T
  fresh: boolean
}

/**
 * Configuration for a single-entity read-through cache. The caller supplies how
 * to read/write/drop its own cache and how to fetch; readThroughCache owns the
 * cache-aside sequence so no caller can reintroduce a delete-before-fetch.
 */
export interface ReadThroughCacheOptions<T> {
  /** True when the network is reachable (navigator online, or emulator). */
  isOnline: boolean

  /** Read the cached value, or undefined when absent. */
  readCache: () => Promise<CachedValue<T> | undefined>

  /**
   * Fetch the fresh value from the backend. Must throw a ConnectivityError on a
   * connectivity failure (e.g. by wrapping in withConnectivityHandling) so it
   * can be told apart from a fatal error. Returns undefined when the entity
   * does not exist on the backend.
   */
  fetch: () => Promise<T | undefined>

  /** Persist a freshly fetched value. */
  writeCache: (value: T) => Promise<void>

  /**
   * Remove the cached entry (entity confirmed absent on the backend). Receives
   * the dropped value so adapters can also purge secondary index entries
   * derived from it.
   */
  dropCache: (value: T) => Promise<void>
}

/**
 * Reads a single entity through a cache, cache-aside style.
 *
 * The cache is only ever written on a definitive outcome — set on a
 * successful
 * fetch, drop on a confirmed server-side deletion. It is never deleted
 * speculatively, so a failed refresh always leaves the saved copy intact (no
 * delete-then-restore).
 *
 * Outcomes:
 * - fresh cache             → serve it, no network
 * - offline + cache         → serve stale (the app surfaces the state)
 * - offline + no cache      → throw ConnectivityError (nothing to show)
 * - fetch ok                → overwrite cache, return fresh value
 * - fetch ok, entity gone   → drop cache, return undefined
 * - connectivity + cache    → serve stale, cache untouched
 * - connectivity, no cache  → throw ConnectivityError (blocking page)
 * - fatal error             → propagate
 */
export const readThroughCache = async <T>(
  options: ReadThroughCacheOptions<T>,
): Promise<T | undefined> => {
  // Retry the whole read on a getsetdel store reset (rare; e.g. another tab
  // cleared the store), with exponential backoff.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const cached = await options.readCache()

      // Fresh cache: no network needed.
      if (cached?.fresh) {
        return cached.value
      }

      // Offline: serve the saved copy if we have one, otherwise there is
      // nothing to show.
      if (!options.isOnline) {
        if (cached) {
          return cached.value
        }

        throw new ConnectivityError(ConnectionStatus.Offline)
      }

      // Online: fetch a fresh value (cache is stale or absent).
      let data: T | undefined

      try {
        data = await options.fetch()
      } catch (error) {
        // Connectivity failure with a saved copy: serve it, cache untouched.
        // No cache (or a fatal error): propagate.
        if (error instanceof ConnectivityError && cached) {
          return cached.value
        }

        throw error
      }

      // Entity no longer exists on the backend: drop the stale cache entry.
      if (data === undefined) {
        if (cached) {
          await options.dropCache(cached.value)
        }

        return undefined
      }

      // Fresh value: overwrite the cache and return it.
      await options.writeCache(data)

      return data
    } catch (error) {
      if (!(error instanceof GetSetDelResetError)) {
        throw error
      }

      // Exponential backoff before retrying the store operations.
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000))
    }
  }

  throw new Error('Failed to read through cache after 3 attempts')
}
