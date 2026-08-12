/** Extra cleanup a consuming app runs alongside the Firestore wipe. */
export type EmulatorReset = () => Promise<unknown>

/** What an app binds its emulator-backed test hooks to. */
export interface EmulatorHooksOptions {
  /**
   * Prefix of the emulator project id every test reads and writes through.
   * Kept under Firebase's 30-character limit once the isolation suffixes are
   * appended.
   */
  projectIdBase: string
  /**
   * Any string stable per checkout and distinct between checkouts —
   * `import.meta.url` from the app's own setup file is the usual choice. It is
   * hashed into the project id so two checkouts pointed at one emulator do not
   * wipe each other's seeded data.
   */
  isolationSeed: string
  /**
   * Where the app's emulator listens. Only applied when the variables are not
   * already set, so a runner that exports its own (`firebase emulators:exec`)
   * still wins.
   */
  firestoreHost: string
  authHost: string
  /**
   * Run alongside the Firestore wipe before and after each file — for state the
   * Firestore REST reset does not reach, such as emulator auth users.
   */
  onReset?: EmulatorReset
  /**
   * Appended to the message shown when no emulator answers, naming whatever
   * starts one in this app (`run \`yarn test:up\``).
   */
  startInstruction: string
}
