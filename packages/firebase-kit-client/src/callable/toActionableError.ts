import { ConnectivityError } from '../connectivity/ConnectivityError.js'
import type { CreateErrorFunction } from '../types.js'

/**
 * Builds the error a callable caller should throw when a call fails.
 *
 * Connectivity errors carry their own handling (offline UI / cache fallback),
 * so they are returned untouched — masking one as a fatal error would strip the
 * `instanceof ConnectivityError` identity the app's error handler relies on.
 * Everything else becomes a fatal error. Keeping this guard in one helper means
 * new callers inherit it instead of re-implementing it.
 */
export const toActionableError = (
  createError: CreateErrorFunction,
  error: unknown,
  message: string,
): Error => {
  if (error instanceof ConnectivityError) {
    return error
  }

  return createError({
    message,
    cause: error,
    fatal: true,
  })
}
