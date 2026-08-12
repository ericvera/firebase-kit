import { getErrorWithCode } from '../getErrorWithCode.js'
import { ConnectivityError } from './ConnectivityError.js'
import { ConnectionStatus } from './constants.js'
import type { ConnectivityHandlingDependencies } from './types.js'

/**
 * Wraps a service call with connectivity error handling
 * If the call fails with connectivity-related errors, checks service status
 * and throws ConnectivityError for graceful fallback to cached data
 *
 * @param dependencies - Bound host-app collaborators
 * @param serviceCall - The service call to wrap (callable, Firestore query,
 * etc.)
 * @returns The result of the service call
 * @throws ConnectivityError - When connectivity issues are detected
 * @throws Original error - For non-connectivity issues (fatal errors)
 */
export const withConnectivityHandling = async <T>(
  dependencies: ConnectivityHandlingDependencies,
  serviceCall: () => Promise<T>,
): Promise<T> => {
  const { connectivity, isClient, isPotentialConnectivityErrorCode } =
    dependencies

  try {
    const result = await serviceCall()

    // Reached the backend: connectivity is healthy. Clears the offline banner
    // a prior failed read may have raised. Client-only state; skip on server.
    if (isClient) {
      connectivity.markHealthy()
    }

    return result
  } catch (error) {
    const { code: errorCode } = getErrorWithCode(error)

    // Check if this error code indicates potential connectivity issues
    if (isPotentialConnectivityErrorCode(errorCode)) {
      // Probe + update the connection status in one place, then react. A
      // degraded status surfaces the offline banner (reads fall back to
      // cache); Online means connectivity is fine, so this is a different error
      // and we fall through to re-throw the original below.
      const status = await connectivity.refreshConnectionStatus()

      if (status !== ConnectionStatus.Online) {
        throw new ConnectivityError(status)
      }
    }

    // Not a connectivity error, or services are online - propagate original
    // error
    throw error
  }
}
