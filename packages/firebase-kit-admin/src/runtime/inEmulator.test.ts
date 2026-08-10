import { afterEach, expect, it, vi } from 'vitest'
import { inEmulator } from './inEmulator.js'
import { FunctionsEmulatorEnabledValue } from './internal/constants.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('returns true when runtime context is Emulator', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('FUNCTIONS_EMULATOR', FunctionsEmulatorEnabledValue)

  expect(inEmulator()).toEqual(true)
})

it('returns false when runtime context is UnitTest', () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('FUNCTIONS_EMULATOR', undefined)

  expect(inEmulator()).toEqual(false)
})

it('returns false when runtime context is Production', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('FUNCTIONS_EMULATOR', undefined)

  expect(inEmulator()).toEqual(false)
})
