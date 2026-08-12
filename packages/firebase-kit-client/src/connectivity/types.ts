import type { ConnectionStatus } from './constants.js'

/**
 * The two connectivity operations the client needs from the host app's
 * connection state. Implementations must resolve their backing state *inside*
 * the method body — the client is bound at module scope, before an app's
 * reactive store or context has been created.
 */
export interface ConnectivityPort {
  /** A backend call succeeded, so the connection is healthy again. */
  markHealthy: () => void
  /** Probe connectivity, record the result, and return the resolved status. */
  refreshConnectionStatus: () => Promise<ConnectionStatus>
}

/** Host-app collaborators `withConnectivityHandling` is bound to. */
export interface ConnectivityHandlingDependencies {
  isClient: boolean
  connectivity: ConnectivityPort
  isPotentialConnectivityErrorCode: (errorCode: string | undefined) => boolean
}
