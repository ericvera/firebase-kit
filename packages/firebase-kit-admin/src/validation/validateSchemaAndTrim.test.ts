import { boolean, object, string } from 'betterbe'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import { validateSchemaAndTrim } from './validateSchemaAndTrim.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

const schema = object({ a: boolean() })

it('works when the validation fails', async () => {
  await expect(
    validateSchemaAndTrim(schema, { token: {}, uid: 'someuid' } as AuthData, {
      a: 12,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Value of 'a' is not the expected type (expected type: 'boolean').]`,
  )
})

it('works when the validation fails due to unexpected properties', async () => {
  await expect(
    validateSchemaAndTrim(schema, undefined, { b: { c: 1 }, a: true }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Unexpected unknown key 'b' at root.]`,
  )
})

it('works when the validation succeeds', async () => {
  await expect(
    validateSchemaAndTrim(schema, undefined, { a: false }),
  ).resolves.not.toThrow()
})

it('also trims strings', async () => {
  const schemaWithStrings = object({ a: string(), b: object({ c: string() }) })

  const result = await validateSchemaAndTrim(schemaWithStrings, undefined, {
    a: '  a\n\t  ',
    b: { c: '\t' },
  })

  expect(result).toMatchInlineSnapshot(`
    {
      "a": "a",
      "b": {
        "c": "",
      },
    }
  `)
})
