import { vi } from 'vitest'
import type { FirebaseFunctionsMockOptions } from './types.js'

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase-functions` module, so a bare
 * `vi.mock('firebase-functions')` swaps the logger for spies while leaving the
 * function builders real.
 */
export const createFirebaseFunctionsMock = ({
  actual,
}: FirebaseFunctionsMockOptions) => {
  // NOTE: Mock the logger as it calls console.error which causes problems with
  // tests
  const logger = {
    write: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
  }

  return {
    https: actual.https,
    logger,
    onInit: actual.onInit,
    pubsub: actual.pubsub,
  }
}
