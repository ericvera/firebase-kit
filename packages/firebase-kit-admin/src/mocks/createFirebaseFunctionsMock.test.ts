import { expect, it } from 'vitest'
import { createFirebaseFunctionsMock } from './createFirebaseFunctionsMock.js'

const actual = {
  https: 'real https' as never,
  onInit: 'real onInit' as never,
  pubsub: 'real pubsub' as never,
}

it('swaps the logger for spies', () => {
  const mock = createFirebaseFunctionsMock({ actual })

  mock.logger.error('something broke')

  // Verify: logging is captured rather than printed — the real logger writes to
  // console.error, which floods a test run
  expect(mock.logger.error).toHaveBeenCalledWith('something broke')
})

it('exposes every logger level the real module has', () => {
  const mock = createFirebaseFunctionsMock({ actual })

  // Verify: a call site reaching for any level finds a spy, not undefined
  expect(Object.keys(mock.logger).sort()).toMatchInlineSnapshot(`
    [
      "debug",
      "error",
      "info",
      "log",
      "warn",
      "write",
    ]
  `)
})

it('hands the function builders back untouched', () => {
  const mock = createFirebaseFunctionsMock({ actual })

  // Verify: only the logger is faked — a suite still defines real functions,
  // which is what makes `__endpoint` inspection work
  expect(mock.https).toBe(actual.https)
  expect(mock.onInit).toBe(actual.onInit)
  expect(mock.pubsub).toBe(actual.pubsub)
})

it('gives each bind its own logger spies', () => {
  const first = createFirebaseFunctionsMock({ actual })
  const second = createFirebaseFunctionsMock({ actual })

  first.logger.warn('only mine')

  // Verify: two suites installing the shim do not share call history
  expect(second.logger.warn).not.toHaveBeenCalled()
})
