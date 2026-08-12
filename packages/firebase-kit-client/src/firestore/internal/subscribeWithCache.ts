import type { DocumentData } from 'firebase/firestore'
import {
  clear,
  createStore,
  delMany,
  entries,
  GetSetDelResetError,
  setMany,
  setMeta,
} from 'getsetdel'
import { FirestoreVariant } from '../constants.js'
import { reviveTimestamps } from '../reviveTimestamps.js'
import type {
  FirestoreTimestamp,
  FirestoreUtilsDependencies,
  ID,
  SubscribeWithCacheOptions,
  SubscriptionUpdate,
  WithID,
} from '../types.js'
import { getMetadata } from './getMetadata.js'
import { maxTimestamp } from './maxTimestamp.js'
import { createSubscribe } from './subscribe.js'
import type { CacheMetadata } from './types.js'

export const createSubscribeWithCache = (
  dependencies: FirestoreUtilsDependencies,
) => {
  const logger = dependencies.createLogger('subscribeAndCache')
  const subscribe = createSubscribe(dependencies)

  /**
   * Subscribes to a Firestore collection with real-time updates and caching.
   *
   * Use this for collections that need real-time updates with offline support.
   * Combines cached data with live subscriptions and handles connection issues
   * gracefully. Shows cached data first, then real-time updates.
   *
   * @template DBT - The Firestore document data type
   * @template T - The client-side type (DBT with id field)
   * @param options - Configuration for subscription and caching
   * @returns Function to unsubscribe from the real-time listener
   */
  const subscribeWithCache = async <
    DBT extends DocumentData,
    T extends WithID<DBT> = WithID<DBT>,
  >(
    options: SubscribeWithCacheOptions<DBT, T>,
  ): Promise<() => void> => {
    let unsubscribe: () => void
    let unsubscribing = false

    // Combines items from the cache and the initial query
    let warmupItems: Map<ID, DBT> | undefined = new Map()

    try {
      const { name, key, version, tags } = options

      // - Initialize store
      //
      // NOTE: The global cache version is part of the store version here, as
      // it is in every other cached read and in the re-initialize below.
      // Leaving it out meant bumping it invalidated document caches but
      // silently left every subscription cache in place.
      let storeToken = await createStore({
        name,
        version: (version ?? 0) + dependencies.cacheVersion,
        ...(key === undefined ? {} : { key }),
        ...(tags === undefined ? {} : { tags }),
      })

      // - Load current metadata
      let metadata: CacheMetadata | undefined = await getMetadata(
        storeToken,
        FirestoreVariant.Firestore,
      )

      logger.log(`${options.name} - metadata:`, metadata)

      // - If there is already data in the store, check if we should clear it
      //   or process the items
      if (metadata?.latestUpdated) {
        if (options.shouldClear?.(metadata.latestUpdated)) {
          // Clear the store based on shouldClear function
          logger.log(
            `${options.name} - clearing cache based on shouldClear function`,
          )

          // Clear the store
          await clear(storeToken)

          // Re-initialize the store
          storeToken = await createStore({
            name,
            version: (version ?? 0) + dependencies.cacheVersion,
            ...(key === undefined ? {} : { key }),
            ...(tags === undefined ? {} : { tags }),
          })
          metadata = await getMetadata(storeToken, FirestoreVariant.Firestore)

          // NOTE: We continue with the subscription process as this is a normal
          // operation, not an error condition. The warmup query will run if
          // provided.
        } else {
          // - Process cached items
          try {
            // Revive timestamps on all items from store and filter out items to
            // remove
            const cachedEntries = await entries<DBT>(storeToken)
            const itemsToRemove: ID[] = []

            for (const [id, data] of cachedEntries) {
              // Revive timestamps
              const revivedData = await reviveTimestamps(
                data,
                FirestoreVariant.Firestore,
              )

              // Check if item should be removed based on shouldRemove function
              if (options.shouldRemove?.({ ...revivedData, id } as T)) {
                logger.log(
                  `${options.name} - removing item '${id}' based on shouldRemove`,
                )
                itemsToRemove.push(id)
              } else {
                warmupItems.set(id, revivedData)
              }
            }

            // Process itemsToRemove if there are any
            if (itemsToRemove.length > 0) {
              logger.log(
                `${options.name} - removing ${String(itemsToRemove.length)} items based on shouldRemove`,
              )
              await delMany(storeToken, [...itemsToRemove])
            }

            logger.log(`${options.name} - cached data loaded and processed`)
          } catch (error) {
            logger.error(
              `${options.name} - error processing cached entries, clearing cache and continuing with warmup query and/or subscription:`,
              error,
            )

            // NOTE: We throw the error so that the caller can handle it. This
            // will allow the user to recover, but we don't hide the error.
            await clear(storeToken)

            throw error
          }
        }
      }

      // NOTE: Initialize here as metadata could have been reset during the
      // process of loading cached items
      let currentSince: FirestoreTimestamp | undefined = metadata?.latestUpdated

      // Quick offline check - if offline and not in emulator, use cached data
      if (!navigator.onLine && !options.inEmulator) {
        logger.log(`${options.name} - offline, using cached data only`)

        // Always call onUpdates with initial data (empty or cached)
        options.onUpdates({
          set: [...warmupItems.entries()],
          remove: [],
        })

        // Return a no-op unsubscribe function
        return () => {
          logger.log(`${options.name} - offline unsubscribe (no-op)`)
        }
      }

      // - If there is no data in the store or it was cleared, we need to load
      //   data using options.warmupQuery (if applicable)
      if (!currentSince && options.warmupQuery) {
        logger.log(`${options.name} - loading warmup query`)

        try {
          const { getDocs } = await import('firebase/firestore')

          const snapshot = await getDocs<DBT, DBT>(await options.warmupQuery())

          for (const doc of snapshot.docs) {
            const docData = doc.data()

            // This should rarely happen, but if we receive an item from the
            // warmup query that should be removed, we just ignore it.
            if (options.shouldRemove?.({ ...docData, id: doc.id } as T)) {
              logger.warn(
                `${options.name} - received item from warmup query that should be removed, ignoring`,
              )
            } else {
              warmupItems.set(doc.id, docData)
            }

            // Update currentSince timestamp only if there is one available.
            // This way when executing the subscribe query the caller can decide
            // what they want when there is no currentSince value (e.g. set to
            // 0 or to some other value).
            currentSince = currentSince
              ? maxTimestamp(currentSince, docData[options.syncProp])
              : docData[options.syncProp]
          }

          // Prepare and execute store updates
          const updates: Promise<unknown>[] = []

          if (currentSince) {
            metadata = { latestUpdated: currentSince }
            updates.push(setMeta<CacheMetadata>(storeToken, metadata))
          }

          // NOTE: warmupItems only has a value if there were no cached items
          // the cached items were removed and then items were added as a result
          // of the warmup query.
          if (warmupItems.size > 0) {
            // Update the store with the items from the warmup query
            updates.push(setMany(storeToken, [...warmupItems.entries()]))
          }

          await Promise.all(updates)
        } catch (error) {
          logger.error(`${options.name} - error loading warmup query:`, error)

          // Allow error to propagate to caller
          throw error
        }
      }

      // Call onUpdates immediately with cached data if available
      if (warmupItems.size > 0) {
        logger.log(`${options.name} - sending cached data immediately`)

        options.onUpdates({
          set: [...warmupItems.entries()],
          remove: [],
        })

        // Clear warmupItems as they've been sent
        warmupItems = undefined
      }

      logger.log(
        `${options.name} - subscribing to query with since: ${String(currentSince?.toDate())}...`,
      )

      const handleUpdates = async ({
        set,
        remove,
      }: SubscriptionUpdate<DBT>) => {
        logger.log('onUpdates -', options.name)

        if (unsubscribing) {
          logger.log('onUpdates - unsubscribing, ignoring updates')
          return
        }

        try {
          const itemsToRemove = new Set<ID>(remove)
          const itemsToSet = new Map<ID, DBT>()
          let newSince = currentSince

          // Process set operations
          for (const [id, docData] of set) {
            newSince = newSince
              ? maxTimestamp(newSince, docData[options.syncProp])
              : docData[options.syncProp]

            // Check if item should be removed
            if (options.shouldRemove?.({ ...docData, id } as T)) {
              itemsToRemove.add(id)
            } else {
              itemsToSet.set(id, docData)
            }
          }

          // Add remove operations
          for (const id of remove) {
            itemsToRemove.add(id)
          }

          // Notify callback with updates only (cached data already sent)
          options.onUpdates({
            set: [...itemsToSet.entries()],
            remove: [...itemsToRemove],
          })

          // Prepare store updates
          const storeUpdates: Promise<void>[] = []

          if (newSince && (!currentSince || !newSince.isEqual(currentSince))) {
            storeUpdates.push(
              setMeta(storeToken, { ...metadata, latestUpdated: newSince }),
            )
          }

          if (itemsToSet.size > 0) {
            storeUpdates.push(setMany(storeToken, [...itemsToSet.entries()]))
          }

          if (itemsToRemove.size > 0) {
            storeUpdates.push(delMany(storeToken, [...itemsToRemove]))
          }

          // Execute store updates if any
          if (storeUpdates.length > 0) {
            await Promise.all(storeUpdates)
          }
        } catch (error) {
          // If the error is due to GetSetDelResetError, call onReset
          if (error instanceof GetSetDelResetError) {
            logger.warn(
              `${options.name} - Error due to GetSetDelResetError on onUpdates, calling onReset`,
            )

            options.onReset()
          } else {
            throw error
          }
        }
      }

      unsubscribe = await subscribe({
        subscribeQuery: async () => options.subscribeQuery(currentSince),
        // `subscribe` expects a void-returning callback, so the update work is
        // started and deliberately not awaited here.
        onUpdates: (updates) => {
          void handleUpdates(updates)
        },
        // Pass through onError for subscribe errors
        onError: options.onError,
        isLoggedIn: options.isLoggedIn,
      })
    } catch (error) {
      // Only handle GetSetDelResetError specifically since it's related to the
      // caching mechanism
      if (error instanceof GetSetDelResetError) {
        logger.warn(
          `${options.name} - Error due to GetSetDelResetError on subscription attempt, calling onReset (error: ${error})`,
        )
        options.onReset()

        // Return a no-op function as we failed to create a proper subscription
        // due to a reset
        return () => {
          logger.log(
            `${options.name} - no subscription to unsubscribe from (GetSetDelResetError occurred)`,
          )
        }
      }

      // All other errors should be handled by the caller
      throw error
    }

    return () => {
      logger.log('unsubscribe() - unsubscribing from', options.name)
      unsubscribing = true
      unsubscribe()
    }
  }

  return subscribeWithCache
}
