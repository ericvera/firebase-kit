/**
 * Options an application binds once so its handler tests can build callable
 * requests and handler request data without repeating its own wire
 * configuration.
 */
export interface RequestBuildersOptions {
  /** API version stamped onto the request data every builder produces. */
  apiVersion: number
  /** Origin header the built callable request arrives with. */
  appUrl: string
}
