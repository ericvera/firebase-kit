import { type Mock, vi } from 'vitest'
import type { FirebaseFunctionsMockOptions } from './types.js'

/**
 * Builds the mock a test suite re-exports from its
 * `__mocks__/firebase-functions` module, so a bare
 * `vi.mock('firebase-functions')` swaps the logger for spies while leaving the
 * function builders real.
 */
export const createFirebaseFunctionsMock = ({
  actual,
}: FirebaseFunctionsMockOptions) => {
  // NOTE: Mock the logger as it calls console.error which causes problems with
  // tests
  //
  // Each member is annotated rather than left inferred: an inferred `vi.fn()`
  // is `Mock<Procedure>`, and `Procedure` is declared in `@vitest/spy`, which
  // `vitest` does not re-export — so declaration emit would name a module this
  // package does not declare. `Mock` is `Mock<Procedure>`, so nothing narrows.
  const logger: {
    write: Mock
    debug: Mock
    error: Mock
    info: Mock
    log: Mock
    warn: Mock
  } = {
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
