/** Where one test run's Firebase app points. */
export interface TestAppOptions {
  /** Emulator project the run is isolated to. */
  projectId: string
  /**
   * Where the app's emulator listens. Only applied when the variables are not
   * already set, so a runner that exports its own (`firebase emulators:exec`)
   * still wins.
   */
  firestoreHost: string
  authHost: string
}
