import type { CallableOptions } from 'firebase-functions/https'

interface OnCallGlobalOptionsConfig {
  /** Origins allowed to call the group's functions */
  cors: string[]

  /** Whether App Check tokens are required (usually off in the emulator) */
  enforceAppCheck: boolean

  /** Region to pin the group to. Omit to take the platform default. */
  region?: string
}

/**
 * Builds the shared `onCall` options object every callable group spreads into
 * its function definitions. Call it at module scope so the resulting object is
 * ready by the time the group registers its callables.
 *
 * `region` is omitted from the result when not provided, so the options object
 * stays exactly what an app that takes the platform default would write by
 * hand.
 */
export const createOnCallGlobalOptions = ({
  cors,
  enforceAppCheck,
  region,
}: OnCallGlobalOptionsConfig): CallableOptions => ({
  enforceAppCheck,
  cors,
  ...(region === undefined ? {} : { region }),
})
