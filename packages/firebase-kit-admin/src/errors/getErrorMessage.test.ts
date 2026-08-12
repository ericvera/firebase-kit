import { expect, it, vi } from 'vitest'
import { getErrorMessage } from './getErrorMessage.js'

vi.mock('firebase-functions')

it('returns string error as-is', () => {
  const errorMessage = 'This is a string error'

  const result = getErrorMessage(errorMessage)

  expect(result).toMatchInlineSnapshot(`"This is a string error"`)
})

it('extracts message from Error object', () => {
  const error = new Error('This is an Error object')

  const result = getErrorMessage(error)

  expect(result).toMatchInlineSnapshot(`"This is an Error object"`)
})

it('extracts message from object with message property', () => {
  const error = { message: 'Custom error object' }

  const result = getErrorMessage(error)

  expect(result).toMatchInlineSnapshot(`"Custom error object"`)
})

it('converts non-string message to string', () => {
  const error = { message: 42 }

  const result = getErrorMessage(error)

  expect(result).toMatchInlineSnapshot(`"42"`)
})

it('handles null error', () => {
  const result = getErrorMessage(null)

  expect(result).toMatchInlineSnapshot(`"Unknown error occurred: null"`)
})

it('handles undefined error', () => {
  const result = getErrorMessage(undefined)

  expect(result).toMatchInlineSnapshot(`"Unknown error occurred: undefined"`)
})

it('handles number error', () => {
  const result = getErrorMessage(123)

  expect(result).toMatchInlineSnapshot(`"Unknown error occurred: 123"`)
})

it('handles boolean error', () => {
  const result = getErrorMessage(true)

  expect(result).toMatchInlineSnapshot(`"Unknown error occurred: true"`)
})

it('handles object without message property', () => {
  const error = { code: 'ERROR_CODE', status: 500 }

  const result = getErrorMessage(error)

  expect(result).toMatchInlineSnapshot(
    `"Unknown error occurred: {"code":"ERROR_CODE","status":500}"`,
  )
})

it('handles array error', () => {
  const result = getErrorMessage(['error', 'array'])

  expect(result).toMatchInlineSnapshot(
    `"Unknown error occurred: ["error","array"]"`,
  )
})
