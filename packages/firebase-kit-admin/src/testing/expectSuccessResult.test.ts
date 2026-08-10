import { SuccessResult } from 'firebase-kit-protocol'
import { expect, it } from 'vitest'
import { expectSuccessResult } from './expectSuccessResult.js'

it('passes for a response carrying the success result', async () => {
  // Verify: the shape every outcome-only callable returns
  await expectSuccessResult(Promise.resolve({ result: SuccessResult.Success }))
})

it('passes when the response carries extra fields alongside the result', async () => {
  // Verify: the assertion is a subset match, so a handler that also returns
  // data is still accepted by it
  await expectSuccessResult(
    Promise.resolve({ result: SuccessResult.Success, entryId: 'entry-1' }),
  )
})

it('fails for a response with a different result', async () => {
  const failing = expectSuccessResult(Promise.resolve({ result: 'rejected' }))

  // Verify: a handler that returned some other outcome is caught rather than
  // passing silently
  await expect(failing).rejects.toThrow()
})

it('fails when the response rejects', async () => {
  const failing = expectSuccessResult(Promise.reject(new Error('boom')))

  // Verify: a thrown handler fails the assertion instead of the rejection
  // escaping unhandled
  await expect(failing).rejects.toThrow()
})
