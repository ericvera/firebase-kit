export interface KeepaliveCallErrorOptions extends ErrorOptions {
  /** Sets {@link KeepaliveCallError.code}. */
  code?: string | undefined

  /** Sets {@link KeepaliveCallError.status}. */
  status?: number | undefined

  /** Sets {@link KeepaliveCallError.details}. */
  details?: unknown
}

/**
 * The error the keepalive caller hands to its `onError` callback. It is never
 * thrown.
 */
export class KeepaliveCallError extends Error {
  /**
   * Callable code in the SDK's `functions/<code>` form, present only when a
   * response came back. A failure that never reached a response, such as an
   * oversized body or a rejected fetch, has no code.
   */
  public readonly code: string | undefined

  /** HTTP status of the response, when one came back. */
  public readonly status: number | undefined

  /** Envelope `error.details` payload, as it arrived. */
  public readonly details: unknown

  public constructor(message: string, options: KeepaliveCallErrorOptions = {}) {
    super(message, options)

    Object.setPrototypeOf(this, new.target.prototype)

    this.name = 'KeepaliveCallError'
    this.code = options.code
    this.status = options.status
    this.details = options.details
  }
}
