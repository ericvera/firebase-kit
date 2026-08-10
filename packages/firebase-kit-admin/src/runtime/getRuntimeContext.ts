import { RuntimeContext } from './constants.js'
import { FunctionsEmulatorEnabledValue } from './internal/constants.js'

/**
 * Detects the current runtime context from environment variables.
 *
 * - UnitTest: NODE_ENV === 'test' (vitest)
 * - Emulator: FUNCTIONS_EMULATOR === 'true' (Firebase emulator)
 * - Production: deployed to production Firebase
 */
export const getRuntimeContext = (): RuntimeContext => {
  if (process.env['NODE_ENV'] === 'test') {
    return RuntimeContext.UnitTest
  }

  if (process.env['FUNCTIONS_EMULATOR'] === FunctionsEmulatorEnabledValue) {
    return RuntimeContext.Emulator
  }

  return RuntimeContext.Production
}
