import { object, record, string } from 'betterbe'
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

it('reports a failed test on a field without repeating its path', async () => {
  const schema = object({
    phone: string({
      test: (_value, report) => {
        report({ message: 'invalid phone number' })
      },
    }),
  })

  await expect(
    validateSchema(schema, testAuthData, { phone: 'x' }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Value of 'phone' failed custom validation (error: 'invalid phone number').]`,
  )
})

it('reports a failed test on a nested field without repeating its path', async () => {
  const schema = object({
    a: object({
      b: string({
        test: (_value, report) => {
          report({ message: 'bad' })
        },
      }),
    }),
  })

  await expect(
    validateSchema(schema, testAuthData, { a: { b: 'x' } }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Value of 'a.b' failed custom validation (error: 'bad').]`,
  )
})

it('reports a failed test on a record key without repeating its path', async () => {
  const schema = object({
    m: record(
      string({
        test: (_value, report) => {
          report({ message: 'badkey' })
        },
      }),
      string(),
    ),
  })

  await expect(
    validateSchema(schema, testAuthData, { m: { k: 'v' } }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Key 'm.k' failed custom validation (error: 'badkey').]`,
  )
})

it('reports a failed test at the root', async () => {
  const schema = object(
    { name: string() },
    {
      test: (_value, report) => {
        report({ message: 'rootbad' })
      },
    },
  )

  await expect(
    validateSchema(schema, testAuthData, { name: 'x' }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Value failed custom validation (error: 'rootbad').]`,
  )
})
