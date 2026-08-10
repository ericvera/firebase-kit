import { firestoreCacheResets } from '../firestore/internal/firestoreCacheResets.js'
import { checkInTestEnvironment } from '../runtime/index.js'

/**
 * Drops the Firestore instance every binding has cached, so the next
 * `getFirestore()` initializes a fresh one. Called from a unit test's
 * `beforeEach` when the case needs to observe initialization itself — an
 * emulator-backed suite never needs it.
 *
 * Guarded rather than merely undocumented: it throws outside a unit-test
 * environment, so shipping a call to it cannot drop a live app's instance.
 */
export const testGetFirestoreReset = (): void => {
  checkInTestEnvironment()

  for (const reset of firestoreCacheResets) {
    reset()
  }
}
