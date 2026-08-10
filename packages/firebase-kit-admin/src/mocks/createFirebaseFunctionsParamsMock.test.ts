import { afterEach, expect, it, vi } from 'vitest'
import { createFirebaseFunctionsParamsMock } from './createFirebaseFunctionsParamsMock.js'

// Stands in for the real `firebase-functions/params`: each call builds a fresh
// param object, so the caching the mock adds is observable.
const actual = {
  defineSecret: (name: string) => ({ name, value: () => 'real' }),
  defineString: (name: string) => ({ name, value: () => 'real' }),
} as never

afterEach(() => {
  vi.unstubAllEnvs()
})

it('resolves a secret to the value the app supplied', () => {
  const { defineSecret } = createFirebaseFunctionsParamsMock({
    actual,
    secretValues: () => ({ API_KEY: 'value-123' }),
  })

  // Verify: the fixture table decides the value, so a handler test never
  // reaches Secret Manager
  expect(defineSecret('API_KEY').value()).toEqual('value-123')
})

it('falls back to a per-name placeholder for an unlisted secret', () => {
  const { defineSecret } = createFirebaseFunctionsParamsMock({
    actual,
    secretValues: () => ({}),
  })

  // Verify: an unmapped secret still resolves, and to something naming itself,
  // so a failure points at which secret was missing
  expect(defineSecret('UNKNOWN_KEY').value()).toEqual('mock-secret-UNKNOWN_KEY')
})

it('returns the same secret instance for repeated definitions', () => {
  const { defineSecret } = createFirebaseFunctionsParamsMock({
    actual,
    secretValues: () => ({}),
  })

  // Verify: the cache is what lets a test override `.value` on the very
  // instance the source module is holding
  expect(defineSecret('API_KEY')).toBe(defineSecret('API_KEY'))
})

it('reads the fixture table on each access rather than at bind time', () => {
  let values: Record<string, string> = {}

  const { defineSecret } = createFirebaseFunctionsParamsMock({
    actual,
    secretValues: () => values,
  })

  const secret = defineSecret('API_KEY')

  values = { API_KEY: 'value-late' }

  // Verify: the table can be built from constants that are still mid-import
  // when the mock module evaluates
  expect(secret.value()).toEqual('value-late')
})

it('resolves a string param from the environment', () => {
  vi.stubEnv('APP_URL', 'https://app.example.com')

  const { defineString } = createFirebaseFunctionsParamsMock({
    actual,
    secretValues: () => ({}),
  })

  // Verify: reading through process.env is what makes vi.stubEnv work on a
  // string param
  expect(defineString('APP_URL').value()).toEqual('https://app.example.com')
})

it('resolves an unset string param to an empty string', () => {
  const { defineString } = createFirebaseFunctionsParamsMock({
    actual,
    secretValues: () => ({}),
  })

  // Verify: an unset param is empty rather than undefined, so a caller
  // concatenating it does not produce "undefined"
  expect(defineString('NOT_SET').value()).toEqual('')
})

it('returns the same string instance for repeated definitions', () => {
  const { defineString } = createFirebaseFunctionsParamsMock({
    actual,
    secretValues: () => ({}),
  })

  // Verify: same caching guarantee as secrets
  expect(defineString('APP_URL')).toBe(defineString('APP_URL'))
})
