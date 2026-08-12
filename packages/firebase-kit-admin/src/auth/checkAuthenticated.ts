import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsUnauthenticatedError } from '../errors/index.js'

/**
 * Guards any authenticated entry point against anonymous callers — a callable,
 * a task, or anything else handed the request's `AuthData`. It narrows the
 * optional auth into the `authData` that downstream checks read, so a handler
 * calls it before anything that depends on a caller identity: authorization,
 * claims lookups, or ownership checks.
 *
 * @throws FunctionsUnauthenticatedError when the request carries no auth
 */
export const checkAuthenticated = (
  auth: AuthData | undefined,
): { authData: AuthData } => {
  if (!auth) {
    throw new FunctionsUnauthenticatedError()
  }

  return {
    authData: auth,
  }
}
