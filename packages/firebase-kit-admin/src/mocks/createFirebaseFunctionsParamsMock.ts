import type { FirebaseFunctionsParamsMockOptions } from './types.js'

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase-functions/params` module, so a bare
 * `vi.mock('firebase-functions/params')` resolves secrets to fixtures instead
 * of reaching Secret Manager, and resolves strings from `process.env`.
 */
export const createFirebaseFunctionsParamsMock = ({
  actual,
  secretValues,
}: FirebaseFunctionsParamsMockOptions) => {
  // NOTE: Cache ensures the same object is returned for repeated calls. This
  // allows tests to override `.value` on the same instance the source holds.
  const secretCache = new Map<string, ReturnType<typeof actual.defineSecret>>()

  const defineSecret = (name: string) => {
    const cachedSecret = secretCache.get(name)

    if (cachedSecret !== undefined) {
      return cachedSecret
    }

    const mockSecret = actual.defineSecret(name)

    mockSecret.value = () => secretValues()[name] ?? `mock-secret-${name}`

    secretCache.set(name, mockSecret)

    return mockSecret
  }

  const stringCache = new Map<string, ReturnType<typeof actual.defineString>>()

  const defineString = (name: string) => {
    const cachedString = stringCache.get(name)

    if (cachedString !== undefined) {
      return cachedString
    }

    const mockParam = actual.defineString(name)

    // Read from process.env so vi.stubEnv() works in tests
    mockParam.value = () => process.env[name] ?? ''

    stringCache.set(name, mockParam)

    return mockParam
  }

  return { defineSecret, defineString }
}
