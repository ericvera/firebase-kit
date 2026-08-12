import { SuccessResult } from 'firebase-kit-protocol'
import { expect } from 'vitest'

/**
 * Asserts a handler call resolved with the success result every
 * outcome-only callable response carries. Used by handler tests whose
 * subject returns nothing beyond the result itself.
 */
export const expectSuccessResult = async (response: Promise<unknown>) => {
  await expect(response).resolves.toMatchObject({
    result: SuccessResult.Success,
  })
}
