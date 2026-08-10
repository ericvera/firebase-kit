import type { DocumentData, FirestoreError } from 'firebase/firestore'
import { getErrorWithCode } from '../../getErrorWithCode.js'
import type {
  FirestoreUtilsDependencies,
  SubscribeOptions,
  SubscriptionUpdate,
  WithID,
} from '../types.js'
import { FirestorePermissionDeniedCode } from './constants.js'

export const createSubscribe = (dependencies: FirestoreUtilsDependencies) => {
  const logger = dependencies.createLogger('subscribe')

  const subscribe = async <
    DBT extends DocumentData,
    T extends WithID<DBT> = WithID<DBT>,
  >(
    options: SubscribeOptions<DBT, T>,
  ): Promise<() => void> => {
    const { onSnapshot } = await import('firebase/firestore')

    let unsubscribe: () => void

    try {
      const query = await options.subscribeQuery()

      logger.log('subscribing')

      // Subscribe to changes since last sync
      unsubscribe = onSnapshot(
        query,
        (snapshot) => {
          try {
            logger.log('onSnapshot - New snapshot received')

            const updates: SubscriptionUpdate<DBT> = {
              set: [],
              remove: [],
            }

            for (const change of snapshot.docChanges()) {
              logger.log('onSnapshot - Processing doc changes')

              const docData = change.doc.data()
              const docId = change.doc.id

              // If the item is removed or should be removed, drop it from
              // the store.
              if (
                change.type === 'removed' ||
                options.shouldRemove?.({
                  id: docId,
                  ...docData,
                } as T)
              ) {
                logger.log(`onSnapshot - Document ${docId} removed`)
                updates.remove.push(docId)
              } else {
                logger.log(`onSnapshot - Document ${docId} added/modified`)
                updates.set.push([docId, docData])
              }
            }

            options.onUpdates(updates)
          } catch (error) {
            logger.error('onSnapshot - Error processing doc changes', error)
            options.onError(error)
          }
        },
        (error: FirestoreError) => {
          logger.log('Error in snapshot listener', error)

          // On signOut the SDK restarts open listen streams with null
          // credentials, racing the stores' onLogout unsubscribe; when the
          // server's permission-denied rejection wins the race it lands here.
          // Every listener is auth-gated by construction (public pages read via
          // firestore/lite, which cannot subscribe), so a denial while logged
          // out can only be that teardown race — expected noise, not a fault.
          // Revisit if a public (unauthenticated) subscription is ever added.
          if (
            getErrorWithCode(error).code === FirestorePermissionDeniedCode &&
            !options.isLoggedIn()
          ) {
            logger.warn(
              'Ignoring permission-denied from listener racing logout',
            )
            return
          }

          options.onError(error)
        },
      )
    } catch (error) {
      logger.log('Error subscribing to docs', error)
      options.onError(error)
    }

    return () => {
      logger.log('unsubscribe() - unsubscribing')
      unsubscribe()
    }
  }

  return subscribe
}
