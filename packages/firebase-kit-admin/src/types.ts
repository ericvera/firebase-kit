/**
 * The per-app values `createInit` binds once at module scope. The emulator
 * hosts are the defaults the returned `init` falls back to when the process has
 * not already named its own, so an app that runs several emulators (dev and
 * test, on different ports) keeps whichever one it configured first.
 */
export interface InitOptions {
  /** Storage bucket used whenever a service-account credential is supplied. */
  storageBucket: string
  emulatorProjectId: string
  emulatorStorageBucket: string
  emulatorFirestoreHost: string
  emulatorAuthHost: string
  emulatorStorageHost: string
  /**
   * Whether this process is running against an emulator. Passed in rather than
   * detected here so the app owns the decision, and so an app's tests can
   * intercept it through their own module.
   */
  inEmulator: () => boolean
}
