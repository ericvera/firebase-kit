import { createFirestoreUtils } from '../../firestore/createFirestoreUtils.js'

// The synthetic collections these tests read and write. A consuming app passes
// its own collection enums here; string unions stand in for them.
type TestCollection = 'people' | 'spaces'
type TestSubCollection = 'entries'

/**
 * The single Firestore binding every emulator-backed test in this package goes
 * through — the same shape a consuming app builds in its own database barrel,
 * and the only place `createFirestoreUtils` is exercised against a live
 * instance. Bound once here so a test file never initializes Firestore twice.
 */
export const testDB = createFirestoreUtils<TestCollection, TestSubCollection>({
  // Never reached: `FIRESTORE_EMULATOR_HOST` is always set under this project,
  // so the emulator id below is the one that binds.
  databaseId: 'test-database-id',
  // NOTE: Must stay `(default)`. The per-test reset wipes
  // `…/databases/(default)/documents` by a hardcoded path, so any other id
  // would write to a database the reset never clears and the tests would
  // contaminate each other.
  emulatorDatabaseId: '(default)',
})
