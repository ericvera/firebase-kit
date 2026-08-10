/**
 * Thrown when a value shaped like a Firestore timestamp is missing its
 * `seconds` or `nanoseconds`, which means the cached document or callable
 * response is corrupt rather than merely stale.
 *
 * Owned by this package rather than built through a host error factory, like
 * `ConnectivityError` and `RateLimitError`. A host that shows an error page
 * for unhandled throws already covers it; one that wants to single it out can
 * check `instanceof`.
 */
export class InvalidTimestampError extends Error {
  constructor() {
    super('invalid timestamp received')

    this.name = 'InvalidTimestampError'
  }
}
