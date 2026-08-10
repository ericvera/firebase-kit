import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsFailedPreconditionError } from '../errors/index.js'

/**
 * Builds the API-version guard every callable handler runs before doing any
 * work. The app's current server API version is bound once at setup; the
 * returned function takes the per-call minimum version, so each handler can
 * keep supporting older clients until it needs a newer feature.
 *
 * The returned function strips the `v` field from the request data and throws
 * `failed-precondition` when the client version is missing, too old, or newer
 * than the server. The thrown error carries `currentAPIVersion`, `minVersion`
 * and `clientVersion` in its details so the client can tell a version mismatch
 * apart from other failures and prompt a reload.
 *
 * @param currentVersion - The server's current API version
 *
 * @example
 * ```ts
 * const checkAPIVersion = createAPIVersionCheck(CurrentAPIVersion)
 *
 * export const createSpace = onCall(async ({ auth, data }) => {
 *   // Only clients >= version 5 can call this function
 *   const validatedData = checkAPIVersion(auth, data, 5)
 *   // ... rest of function
 * })
 * ```
 */
export const createAPIVersionCheck =
  (currentVersion: number) =>
  <T extends { v?: number }>(
    auth: AuthData | undefined,
    data: T,
    minVersion: number,
  ): Omit<T, 'v'> => {
    const { v, ...rest } = data

    if (v === undefined) {
      throw new FunctionsFailedPreconditionError(
        auth,
        'API version missing. Please refresh.',
        {
          currentAPIVersion: currentVersion,
          minVersion,
          clientVersion: 'missing',
        },
      )
    }

    if (v < minVersion) {
      throw new FunctionsFailedPreconditionError(
        auth,
        'API version too old. Please refresh.',
        {
          currentAPIVersion: currentVersion,
          minVersion,
          clientVersion: v,
        },
      )
    }

    if (v > currentVersion) {
      throw new FunctionsFailedPreconditionError(
        auth,
        `Client API version is unexpectedly bigger than the current server version ${String(currentVersion)} which is never expected to happen.`,
        {
          currentAPIVersion: currentVersion,
          minVersion,
          clientVersion: v,
        },
      )
    }

    return rest
  }
