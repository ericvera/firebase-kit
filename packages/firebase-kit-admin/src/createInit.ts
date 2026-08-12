import type { AppOptions, ServiceAccount } from 'firebase-admin/app'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import type { InitOptions } from './types.js'

/**
 * Binds an app's project id, storage buckets and emulator hosts to the Firebase
 * Admin initializer. The returned `init` is what an app's entry point calls
 * once per cold start — before any Firestore, Auth or Storage access — passing
 * a service-account credential when running deployed and nothing when running
 * locally. Calling it again after the app exists is a no-op.
 */
export const createInit =
  ({
    emulatorAuthHost,
    emulatorFirestoreHost,
    emulatorProjectId,
    emulatorStorageBucket,
    emulatorStorageHost,
    inEmulator,
    storageBucket,
  }: InitOptions) =>
  (config?: ServiceAccount): void => {
    if (getApps().length === 0) {
      let adminConfig: AppOptions | undefined = undefined

      if (config !== undefined) {
        adminConfig = {
          credential: cert(config),
          storageBucket,
        }
      } else if (inEmulator()) {
        // Only set if not already configured (avoids overwriting test setup)
        process.env['FIRESTORE_EMULATOR_HOST'] ??= emulatorFirestoreHost
        process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= emulatorAuthHost
        process.env['FIREBASE_STORAGE_EMULATOR_HOST'] ??= emulatorStorageHost

        adminConfig = {
          projectId: emulatorProjectId,
          storageBucket: emulatorStorageBucket,
        }
      }

      initializeApp(adminConfig)
    }
  }
