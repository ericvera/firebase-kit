import { RuntimeContext } from './constants.js'
import { getRuntimeContext } from './getRuntimeContext.js'

export const checkInTestEnvironment = () => {
  if (getRuntimeContext() !== RuntimeContext.UnitTest) {
    throw new Error(
      'This code is expected to only run in unit test environments.',
    )
  }
}
