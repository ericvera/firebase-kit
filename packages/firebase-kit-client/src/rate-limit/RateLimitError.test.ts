import { CallableErrorCode } from 'firebase-kit-protocol'
import { expect, it } from 'vitest'
import { RateLimitError } from './RateLimitError.js'

it('creates error with proper code', () => {
  const error = new RateLimitError('registerTerminal', 10, 30000, 11)

  expect(error.code).toBe(CallableErrorCode.ClientRateLimitExceeded)
})

it('creates error with proper details', () => {
  const error = new RateLimitError('registerTerminal', 10, 30000, 11)

  expect(error.details).toMatchInlineSnapshot(`
    {
      "functionName": "registerTerminal",
      "limit": 10,
      "windowMs": 30000,
    }
  `)
})

it('creates error with descriptive message', () => {
  const error = new RateLimitError('registerTerminal', 10, 30000, 11)

  expect(error.message).toMatchInlineSnapshot(`
    "Rate limit exceeded for registerTerminal
      - Limit: 10 calls per 30 seconds
      - Recent calls: 11 in current window
      - This likely indicates a bug (infinite loop, bad watcher, etc.)
      - Check your store watchers and composables for issues"
  `)
})

it('is instance of Error', () => {
  const error = new RateLimitError('registerTerminal', 10, 30000, 11)

  expect(error).toBeInstanceOf(Error)
})
