import { afterEach, expect, it, vi } from 'vitest'
import { checkInTestEnvironment } from './checkInTestEnvironment.js'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('should not throw an error if in unit test', () => {
  vi.stubEnv('NODE_ENV', 'test')

  expect(() => {
    checkInTestEnvironment()
  }).not.toThrow()
})

it('should throw an error if not in unit test', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('FUNCTIONS_EMULATOR', undefined)

  expect(() => {
    checkInTestEnvironment()
  }).toThrowErrorMatchingInlineSnapshot(
    `[Error: This code is expected to only run in unit test environments.]`,
  )
})
