import { object, string } from 'betterbe'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import { validateSchema } from './validateSchema.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

// Stands in for the caller's decoded token. The validator only forwards it to
// the error it throws, so nothing beyond the shape matters here.
const testAuthData = {
  uid: 'some-uid',
  token: {},
} as AuthData

const testSchema = object({
  name: string(),
  value: string(),
})

it('throws FunctionsInvalidArgumentError when schema validation fails', async () => {
  const invalidData = { name: 'test' }

  await expect(
    validateSchema(testSchema, testAuthData, invalidData),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Missing required field 'value'.]`,
  )
})

it('handles unauthenticated requests', async () => {
  const invalidData = { name: 'test' }

  await expect(
    validateSchema(testSchema, undefined, invalidData),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Missing required field 'value'.]`,
  )
})

it('validates and returns data when schema passes', async () => {
  const data = { name: 'test', value: 'hello' }

  const result = await validateSchema(testSchema, testAuthData, data)

  expect(result).toEqual(data)
})

it('preserves whitespace in string values', async () => {
  const dataWithWhitespace = { name: '  test  ', value: '  hello  ' }

  const result = await validateSchema(
    testSchema,
    testAuthData,
    dataWithWhitespace,
  )

  expect(result).toMatchInlineSnapshot(`
    {
      "name": "  test  ",
      "value": "  hello  ",
    }
  `)
})
