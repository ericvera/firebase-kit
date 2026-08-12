import { CallableErrorCode } from 'firebase-kit-protocol'

/**
 * Thrown by the rate limiter when a callable is called more times than its
 * category allows within the window — the call never leaves the browser.
 *
 * It is a bug report, not a user-facing condition: the message names the
 * offending callable and the places a runaway loop usually hides. Host apps
 * catch it by `code` (`CallableErrorCode.ClientRateLimitExceeded`).
 */
export class RateLimitError extends Error {
  public code: string
  public details: { functionName: string; limit: number; windowMs: number }

  constructor(
    functionName: string,
    limit: number,
    windowMs: number,
    actualCalls: number,
  ) {
    const windowSeconds = windowMs / 1000

    super(
      `Rate limit exceeded for ${functionName}\n` +
        `  - Limit: ${String(limit)} calls per ${String(windowSeconds)} seconds\n` +
        `  - Recent calls: ${String(actualCalls)} in current window\n` +
        `  - This likely indicates a bug (infinite loop, bad watcher, etc.)\n` +
        `  - Check your store watchers and composables for issues`,
    )

    this.name = 'RateLimitError'
    this.code = CallableErrorCode.ClientRateLimitExceeded
    this.details = { functionName, limit, windowMs }
  }
}
