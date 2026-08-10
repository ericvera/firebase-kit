import { afterEach, expect, it, vi } from 'vitest'
import { createRateLimiter } from './createRateLimiter.js'
import type { RateLimitConfig } from './types.js'

type TestCategory = 'standard' | 'single'

const rateLimits: Record<TestCategory, RateLimitConfig> = {
  standard: { limit: 4, windowMs: 30000 },
  single: { limit: 1, windowMs: 60000 },
}

afterEach(() => {
  vi.useRealTimers()
})

it('warns once as a key reaches half its limit in development', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const checkRateLimit = createRateLimiter<TestCategory>({
    isDev: true,
    rateLimits,
  })

  for (let index = 0; index < 4; index++) {
    checkRateLimit('fast:update-entry', 'standard')
  }

  // Verify: exactly one warning across the four calls, emitted on the call that
  // finds 2 of 4 already recorded, naming the key, the count and the window
  expect(warn.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "⚠️ Rate limit warning for fast:update-entry: 2/4 calls used (30s window)",
      ],
    ]
  `)
})

it('does not warn outside development', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const checkRateLimit = createRateLimiter<TestCategory>({
    isDev: false,
    rateLimits,
  })

  for (let index = 0; index < 4; index++) {
    checkRateLimit('fast:update-entry', 'standard')
  }

  // Verify: the threshold is crossed exactly as above and nothing is printed
  expect(warn.mock.calls).toMatchInlineSnapshot(`[]`)
})

it('warns once per key rather than once per limiter', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const checkRateLimit = createRateLimiter<TestCategory>({
    isDev: true,
    rateLimits,
  })

  for (let index = 0; index < 3; index++) {
    checkRateLimit('fast:update-entry', 'standard')
    checkRateLimit('app:update-space', 'standard')
  }

  // Verify: both keys warn, each on its own third call, since call records are
  // tracked per key
  expect(warn.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "⚠️ Rate limit warning for fast:update-entry: 2/4 calls used (30s window)",
      ],
      [
        "⚠️ Rate limit warning for app:update-space: 2/4 calls used (30s window)",
      ],
    ]
  `)
})

it('does not warn for a category whose limit has no half', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const checkRateLimit = createRateLimiter<TestCategory>({
    isDev: true,
    rateLimits,
  })

  checkRateLimit('ai:interpret-entry', 'single')

  // Verify: a limit of 1 floors to a threshold of 0, which the first call would
  // otherwise match on an empty record — the guard keeps it silent
  expect(warn.mock.calls).toMatchInlineSnapshot(`[]`)
})

it('throws once a key has spent its budget', () => {
  const checkRateLimit = createRateLimiter<TestCategory>({
    isDev: false,
    rateLimits,
  })

  for (let index = 0; index < 4; index++) {
    checkRateLimit('fast:update-entry', 'standard')
  }

  // Verify: the fifth call inside the window is refused, and the error names
  // the key, the ceiling, the window in seconds and the calls it counted
  expect(() => {
    checkRateLimit('fast:update-entry', 'standard')
  }).toThrowErrorMatchingInlineSnapshot(`
    [RateLimitError: Rate limit exceeded for fast:update-entry
      - Limit: 4 calls per 30 seconds
      - Recent calls: 4 in current window
      - This likely indicates a bug (infinite loop, bad watcher, etc.)
      - Check your store watchers and composables for issues]
  `)
})

it('drops calls out of the budget as they leave the sliding window', () => {
  vi.useFakeTimers()

  const checkRateLimit = createRateLimiter<TestCategory>({
    isDev: false,
    rateLimits,
  })

  checkRateLimit('fast:update-entry', 'standard')
  checkRateLimit('fast:update-entry', 'standard')

  vi.advanceTimersByTime(20000)

  checkRateLimit('fast:update-entry', 'standard')
  checkRateLimit('fast:update-entry', 'standard')

  // Only the first two calls are older than the 30s window by now, so the
  // budget is back to two rather than to four.
  vi.advanceTimersByTime(11000)

  checkRateLimit('fast:update-entry', 'standard')
  checkRateLimit('fast:update-entry', 'standard')

  // Verify: the window slides rather than resetting — two expired calls freed
  // exactly two slots, and the count in the error proves the two calls made at
  // 20s are still held
  expect(() => {
    checkRateLimit('fast:update-entry', 'standard')
  }).toThrowErrorMatchingInlineSnapshot(`
    [RateLimitError: Rate limit exceeded for fast:update-entry
      - Limit: 4 calls per 30 seconds
      - Recent calls: 4 in current window
      - This likely indicates a bug (infinite loop, bad watcher, etc.)
      - Check your store watchers and composables for issues]
  `)
})
