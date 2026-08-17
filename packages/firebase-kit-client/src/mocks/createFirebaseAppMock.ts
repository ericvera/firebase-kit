import type { FirebaseApp, FirebaseOptions } from 'firebase/app'

/**
 * Builds the mock a test suite re-exports from its `__mocks__/firebase/app`
 * module, so a bare `vi.mock('firebase/app')` gives tests an in-memory app
 * registry instead of a real Firebase app.
 *
 * Stateful rather than a fixed return, because the two things suites need from
 * this module are opposites: code under test that resolves an app calls
 * `getApp`, while code that checks whether one exists yet calls `getApps` and
 * wants it empty. Both fall out of the same registry.
 */
export const createFirebaseAppMock = () => {
  const apps: FirebaseApp[] = []

  const initializeApp = (options: FirebaseOptions = {}): FirebaseApp => {
    const app = {
      name: `test-app-${String(apps.length)}`,
      options,
      automaticDataCollectionEnabled: false,
    }

    apps.push(app)

    return app
  }

  const getApps = (): FirebaseApp[] => apps

  // Matches the real module, which throws rather than returning undefined when
  // nothing has been initialized — a suite that forgot to seed one should fail
  // where it forgot, not on a later property access.
  const getApp = (): FirebaseApp => {
    const [app] = apps

    if (app === undefined) {
      throw new Error(
        "Firebase: No Firebase App '[DEFAULT]' has been created - call initializeApp() first (app/no-app)",
      )
    }

    return app
  }

  const resetFirebaseAppMocks = () => {
    apps.splice(0, apps.length)
  }

  return { getApp, getApps, initializeApp, resetFirebaseAppMocks }
}
