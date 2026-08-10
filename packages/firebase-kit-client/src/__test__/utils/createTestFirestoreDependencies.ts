import type { FirestoreUtilsDependencies } from '../../firestore/types.js'

/**
 * The dependency bag every Firestore-layer unit test binds its subject with.
 *
 * The defaults are the inert ones — no named database, the full SDK never
 * forced, the connectivity wrapper a no-op — so a case only names what it
 * actually exercises. Timestamp revival is not among them — the subject
 * imports it directly, so every case gets the real one. Pass `overrides` for
 * what a case does exercise — a `cacheVersion` it pins, say.
 */
export const createTestFirestoreDependencies = (
  overrides: Partial<FirestoreUtilsDependencies> = {},
): FirestoreUtilsDependencies => ({
  cacheVersion: 1,
  createLogger: () => ({
    log: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  }),
  databaseId: () => undefined,
  useFullSDK: () => false,
  withConnectivityHandling: (serviceCall) => serviceCall(),
  ...overrides,
})
