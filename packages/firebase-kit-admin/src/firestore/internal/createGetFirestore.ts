import { getApp, getApps } from 'firebase-admin/app'
import type { Firestore } from 'firebase-admin/firestore'
import { initializeFirestore } from 'firebase-admin/firestore'
import type { FirestoreUtilsOptions } from '../types.js'
import { firestoreCacheResets } from './firestoreCacheResets.js'

/**
 * Binds the app's database ids to a lazily-initialized Firestore accessor —
 * the `getFirestore` every ref builder and transaction helper in this subpath
 * goes through.
 *
 * The cache-dropping callback is registered rather than returned, so
 * `testGetFirestoreReset` can be a plain export of the `./testing` subpath and
 * the production accessor carries no test-only member.
 */
export const createGetFirestore = ({
  databaseId,
  emulatorDatabaseId,
}: FirestoreUtilsOptions) => {
  let db: Firestore | undefined

  // NOTE: preferRest was removed because the REST transport retries
  // ALREADY_EXISTS errors for 10 minutes before surfacing them as
  // DEADLINE_EXCEEDED, breaking create()-based deduplication.
  // Ref: https://github.com/firebase/firebase-admin-node/issues/2587
  const getFirestore = (): Firestore => {
    if (db !== undefined) {
      return db
    }

    if (getApps().length === 0) {
      throw new Error(
        'app unexpectedly undefined when accessing Firestore init',
      )
    }

    // NOTE: Read on every call rather than at bind time, so a process that sets
    // the emulator host after this module loads still lands on the emulator.
    const isEmulator = process.env['FIRESTORE_EMULATOR_HOST'] !== undefined

    db = initializeFirestore(
      getApp(),
      {},
      // Emulator uses the default database
      isEmulator ? emulatorDatabaseId : databaseId,
    )

    // NOTE: This is so that props set to undefined are ignored when writing to
    // Firestore. This is to prevent the need to set all undefined props to
    // null.
    db.settings({ ignoreUndefinedProperties: true })

    return db
  }

  firestoreCacheResets.add(() => {
    db = undefined
  })

  return getFirestore
}
