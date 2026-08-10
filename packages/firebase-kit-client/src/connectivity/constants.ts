/**
 * Resolved connectivity state, most-degraded first. The host app's probe
 * produces it and the client reads it back through the ConnectivityPort; what
 * the app then renders for each state is its own concern.
 */
export enum ConnectionStatus {
  // Everything reachable.
  Online = 'online',
  // Device reports no network (navigator.onLine === false).
  Offline = 'offline',
  // Navigator claims online but the internet is unreachable (an in-app
  // browser, a captive portal) — full bars, nothing loads.
  Unstable = 'unstable',
  // Internet is reachable but the app's own backend health check failed.
  ServicesUnavailable = 'services-unavailable',
}
