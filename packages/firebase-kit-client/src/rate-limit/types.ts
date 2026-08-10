/**
 * How many calls one rate-limit category allows, and over what window. The
 * app owns the numbers — one entry per category it defines.
 */
export interface RateLimitConfig {
  /** The maximum number of calls allowed in the window. */
  limit: number
  /** The window size in milliseconds. */
  windowMs: number
}

/** Host-app configuration a rate limiter is bound to. */
export interface RateLimiterDependencies<TRateLimitCategory extends string> {
  /** Window and ceiling per category. */
  rateLimits: Record<TRateLimitCategory, RateLimitConfig>
  /** Development build, where the half-limit warning prints. */
  isDev: boolean
}
