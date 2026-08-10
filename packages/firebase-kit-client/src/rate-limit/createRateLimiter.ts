import { RateLimitError } from './RateLimitError.js'
import type { CallRecord } from './internal/types.js'
import type { RateLimiterDependencies } from './types.js'

/**
 * Builds a rate limiter: a function that records every call it is handed and
 * throws once a key exceeds its category's sliding window.
 *
 * Each limiter owns its own record map, so two limiters built from the same
 * window table never share a budget.
 */
export const createRateLimiter = <TRateLimitCategory extends string>(
  dependencies: RateLimiterDependencies<TRateLimitCategory>,
) => {
  const callRecords = new Map<string, CallRecord>()

  return (functionName: string, category: TRateLimitCategory): void => {
    const now = Date.now()
    const config = dependencies.rateLimits[category]

    let record = callRecords.get(functionName)

    if (!record) {
      record = { timestamps: [] }
      callRecords.set(functionName, record)
    }

    const windowStart = now - config.windowMs

    record.timestamps = record.timestamps.filter(
      (timestamp) => timestamp > windowStart,
    )

    const warningThreshold = Math.floor(config.limit * 0.5)

    // Equality rather than `>=`, so the warning fires once as the count crosses
    // half the limit instead of on every call from there to the throw.
    if (
      dependencies.isDev &&
      record.timestamps.length === warningThreshold &&
      warningThreshold > 0
    ) {
      console.warn(
        `⚠️ Rate limit warning for ${functionName}: ${String(record.timestamps.length)}/${String(config.limit)} calls used (${String(config.windowMs / 1000)}s window)`,
      )
    }

    if (record.timestamps.length >= config.limit) {
      throw new RateLimitError(
        functionName,
        config.limit,
        config.windowMs,
        record.timestamps.length,
      )
    }

    record.timestamps.push(now)
  }
}
