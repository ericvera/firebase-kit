import { getApps, initializeApp } from 'firebase-admin/app'
import type { TestAppOptions } from './types.js'

/**
 * Initializes the Firebase app an app's emulator tests run against. Called at
 * module scope from the setup file, before any test imports a subject, and a
 * no-op once an app exists — the Admin SDK rejects a second registration.
 *
 * Deliberately not routed through `createInit`: that factory is production
 * code under test elsewhere, so a bug in it must not be able to hide behind
 * the scaffolding that would surface it.
 */
export const initializeTestApp = ({
  projectId,
  firestoreHost,
  authHost,
}: TestAppOptions): void => {
  if (getApps().length > 0) {
    return
  }

  process.env['FIRESTORE_EMULATOR_HOST'] ??= firestoreHost
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= authHost
  // Prevents the GCloud SDK from trying to reach the metadata server
  process.env['GOOGLE_CLOUD_PROJECT'] = projectId

  initializeApp({ projectId })
}
