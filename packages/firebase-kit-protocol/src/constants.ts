/**
 * Generic success result for functions that only return success.
 */
export enum SuccessResult {
  /** Operation completed successfully */
  Success = 'success',
}

/**
 * The error codes that cross the callable boundary — the `code` strings the
 * server's callable error classes put on the wire, plus the one the client's
 * own rate-limit guard raises before a call ever leaves the browser. The
 * client reads them off the thrown error to pick which dialog to render and
 * whether to report the failure, so a value here is a wire contract: changing
 * one changes behavior silently instead of failing to compile.
 */
export enum CallableErrorCode {
  /**
   * Thrown if an internal error occurs in a Firebase Function.
   */
  FunctionsInternalError = 'functions/internal',

  /**
   * Thrown if the user is not authenticated.
   */
  FunctionsUnauthenticated = 'functions/unauthenticated',

  /**
   * Thrown if the user does not have permission to access the resource.
   */
  FunctionsPermissionDenied = 'functions/permission-denied',

  /**
   * Thrown if the request failed because the condition was not met.
   */
  FunctionsFailedPrecondition = 'functions/failed-precondition',

  /**
   * Thrown by httpsCallable when the client-side timeout (timeoutMs on the
   * callable callers) elapses before a response arrives. Usually a stalled
   * connection, so it is probed for connectivity first (offline page / stale
   * cache); when the probe says online it renders the retry connection dialog
   * but stays Rollbar-reportable — the backend answering slower than the
   * client timeout is worth investigating.
   */
  FunctionsDeadlineExceeded = 'functions/deadline-exceeded',

  /**
   * Thrown if too many requests are made to a Firebase Function in a short
   * period. This likely indicates a bug (infinite loop, bad watcher, etc.).
   */
  ClientRateLimitExceeded = 'client/rate-limit-exceeded',
}
