import { expect, it, vi } from 'vitest'
import { getErrorCode } from './getErrorCode.js'

vi.mock('firebase-functions')

it('extracts code from error object with code property', () => {
  const error = {
    code: 'functions/task-already-exists',
    message: 'Task exists',
  }

  const result = getErrorCode(error)

  expect(result).toMatchInlineSnapshot(`"functions/task-already-exists"`)
})

it('extracts code from Error object with code property', () => {
  const error = new Error('Some error')
  ;(error as Error & { code: string }).code = 'ENOENT'

  const result = getErrorCode(error)

  expect(result).toMatchInlineSnapshot(`"ENOENT"`)
})

it('converts non-string code to string', () => {
  const error = { code: 404 }

  const result = getErrorCode(error)

  expect(result).toMatchInlineSnapshot(`"404"`)
})

it('returns undefined for error without code property', () => {
  const error = new Error('Error without code')

  const result = getErrorCode(error)

  expect(result).toMatchInlineSnapshot(`undefined`)
})

it('returns undefined for object without code property', () => {
  const error = { message: 'Error message', status: 500 }

  const result = getErrorCode(error)

  expect(result).toMatchInlineSnapshot(`undefined`)
})

it('returns undefined for null error', () => {
  const result = getErrorCode(null)

  expect(result).toMatchInlineSnapshot(`undefined`)
})

it('returns undefined for undefined error', () => {
  const result = getErrorCode(undefined)

  expect(result).toMatchInlineSnapshot(`undefined`)
})

it('returns undefined for string error', () => {
  const result = getErrorCode('string error')

  expect(result).toMatchInlineSnapshot(`undefined`)
})

it('returns undefined for number error', () => {
  const result = getErrorCode(123)

  expect(result).toMatchInlineSnapshot(`undefined`)
})

it('returns undefined for boolean error', () => {
  const result = getErrorCode(true)

  expect(result).toMatchInlineSnapshot(`undefined`)
})

it('returns undefined for array error', () => {
  const result = getErrorCode(['error', 'array'])

  expect(result).toMatchInlineSnapshot(`undefined`)
})
