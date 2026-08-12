import { afterEach, expect, it, vi } from 'vitest'
import { RuntimeContext } from './constants.js'
import { getRuntimeContext } from './getRuntimeContext.js'
import { FunctionsEmulatorEnabledValue } from './internal/constants.js'

vi.mock('firebase-functions')

afterEach(() => {
  vi.unstubAllEnvs()
})

it('returns UnitTest when NODE_ENV is test', () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('FUNCTIONS_EMULATOR', undefined)

  expect(getRuntimeContext()).toEqual(RuntimeContext.UnitTest)
})

it('returns Emulator when FUNCTIONS_EMULATOR is enabled and NODE_ENV is not test', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('FUNCTIONS_EMULATOR', FunctionsEmulatorEnabledValue)

  expect(getRuntimeContext()).toEqual(RuntimeContext.Emulator)
})

it('returns Production when not in test and not in emulator', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('FUNCTIONS_EMULATOR', undefined)

  expect(getRuntimeContext()).toEqual(RuntimeContext.Production)
})

it('prioritizes UnitTest over Emulator when both conditions match', () => {
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('FUNCTIONS_EMULATOR', FunctionsEmulatorEnabledValue)

  expect(getRuntimeContext()).toEqual(RuntimeContext.UnitTest)
})

it('returns Production when FUNCTIONS_EMULATOR has non-enabled value', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('FUNCTIONS_EMULATOR', 'false')

  expect(getRuntimeContext()).toEqual(RuntimeContext.Production)
})
