import type { ConnectionStatus } from './constants.js'

/**
 * The degraded states a ConnectivityError can carry — every ConnectionStatus
 * except Online (a healthy connection isn't an error).
 */
export type ConnectivityStatus = Exclude<
  ConnectionStatus,
  ConnectionStatus.Online
>

/**
 * Error thrown when connectivity issues are detected (offline, unstable, or a
 * service outage). This allows for graceful fallback to cached data in data
 * fetching utilities.
 */
export class ConnectivityError extends Error {
  public readonly status: ConnectivityStatus

  public constructor(status: ConnectivityStatus, message?: string) {
    // An empty message falls back to the default too, so a caller passing a
    // blank string still gets a message naming the status.
    super(
      message === undefined || message === ''
        ? `Connectivity issue: ${status}`
        : message,
    )

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)

    this.name = 'ConnectivityError'
    this.status = status
  }
}
