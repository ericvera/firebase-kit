import { createHash } from 'node:crypto'

/**
 * Builds the accessor for the emulator project one app's tests read and write
 * through.
 *
 * Two things keep concurrent runs off each other's data. The seed is hashed
 * into the id so two checkouts pointed at one emulator do not wipe each other,
 * and the `VITEST_POOL_ID` suffix does the same for two workers inside one run
 * — read per call, because the variable is set by the worker rather than by
 * the process this binding happens in.
 *
 * Hashing rather than using the seed directly keeps the id short and free of
 * characters Firebase rejects, whatever the app passed.
 */
export const createGetTestProjectId = (
  projectIdBase: string,
  isolationSeed: string,
) => {
  const isolationSuffix = createHash('sha1')
    .update(isolationSeed)
    .digest('hex')
    .slice(0, 8)

  return () =>
    `${projectIdBase}-${isolationSuffix}${process.env['VITEST_POOL_ID'] ?? ''}`
}
