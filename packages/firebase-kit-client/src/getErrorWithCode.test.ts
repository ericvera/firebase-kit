import { expect, it } from 'vitest'
import { getErrorWithCode } from './getErrorWithCode.js'

it('returns the code and details when the error carries a code', () => {
  const error = Object.assign(new Error('boom'), {
    code: 'functions/internal',
    details: { entryId: 'order-id' },
  })

  // Verify: the error itself is passed through, code is read, details kept
  expect(getErrorWithCode(error)).toMatchInlineSnapshot(`
    {
      "code": "functions/internal",
      "details": {
        "entryId": "order-id",
      },
      "error": [Error: boom],
    }
  `)
})

it('returns undefined details when the coded error has no details object', () => {
  const error = Object.assign(new Error('boom'), {
    code: 'functions/internal',
    details: 'not-an-object',
  })

  // Verify: a non-object details value is dropped rather than passed through
  expect(getErrorWithCode(error)).toMatchInlineSnapshot(`
    {
      "code": "functions/internal",
      "details": undefined,
      "error": [Error: boom],
    }
  `)
})

it('walks the cause chain to find a nested code', () => {
  const cause = Object.assign(new Error('inner'), {
    code: 'functions/deadline-exceeded',
  })
  const error = new Error('outer', { cause })

  // Verify: the nested cause is what gets reported, not the outer wrapper
  expect(getErrorWithCode(error)).toMatchInlineSnapshot(`
    {
      "code": "functions/deadline-exceeded",
      "details": undefined,
      "error": [Error: inner],
    }
  `)
})

it('returns nothing for a non-object input', () => {
  // Verify: primitives short-circuit to the all-undefined result
  expect(getErrorWithCode('just a string')).toMatchInlineSnapshot(`
    {
      "code": undefined,
      "details": undefined,
      "error": undefined,
    }
  `)
})

it('returns nothing for an object with neither a code nor a cause', () => {
  // Verify: a plain error with no code anywhere yields the same empty result
  expect(getErrorWithCode(new Error('boom'))).toMatchInlineSnapshot(`
    {
      "code": undefined,
      "details": undefined,
      "error": undefined,
    }
  `)
})
