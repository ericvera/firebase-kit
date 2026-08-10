/**
 * Runtime context - where the code is actually running.
 * This is auto-detected from environment variables.
 */
export enum RuntimeContext {
  /** Running vitest unit tests (NODE_ENV === 'test') */
  UnitTest = 'unit-test',

  /** Running in Firebase emulator (FUNCTIONS_EMULATOR === 'true') */
  Emulator = 'emulator',

  /** Deployed to production Firebase */
  Production = 'production',
}
