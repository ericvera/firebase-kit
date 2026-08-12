import { expect, it } from 'vitest'
import { createFirebaseFunctionsClientMock } from './createFirebaseFunctionsClientMock.js'

it('echoes the request payload back as the response', async () => {
  const { httpsCallable } = createFirebaseFunctionsClientMock()

  const result = await httpsCallable()({ action: 'get-entry', entryId: '1' })

  // Verify: a caller test can assert on what it sent without standing up a
  // deployed function
  expect(result).toMatchInlineSnapshot(`
    {
      "data": {
        "action": "get-entry",
        "entryId": "1",
      },
    }
  `)
})

it('rejects a payload asking for an internal error', async () => {
  const { httpsCallable } = createFirebaseFunctionsClientMock()

  const failing = httpsCallable()({ throwInternal: true })

  // Verify: the synthetic internal code the client treats as "the server did
  // not answer in a form we understand"
  await expect(failing).rejects.toThrowErrorMatchingInlineSnapshot(
    `[FirebaseError: Internal error message]`,
  )
})

it('rejects a payload asking for a non-connectivity firebase error', async () => {
  const { httpsCallable } = createFirebaseFunctionsClientMock()

  const failing = httpsCallable()({ throwFirebaseError: true })

  // Verify: permission-denied specifically, because it is not a code the
  // connectivity handler probes — this drives the generic wrapping path
  await expect(failing).rejects.toThrowErrorMatchingInlineSnapshot(
    `[FirebaseError: Firebase error message]`,
  )
})

it('rejects a payload that is not an object', async () => {
  const { httpsCallable } = createFirebaseFunctionsClientMock()

  const failing = httpsCallable()('not an object')

  // Verify: the callable contract is an object payload; anything else fails the
  // way the real SDK would rather than echoing back
  await expect(failing).rejects.toThrowErrorMatchingInlineSnapshot(
    `[FirebaseError: Data must be an object]`,
  )
})

it('resolves a streamed call with the payload and a stream handle', async () => {
  const { httpsCallable } = createFirebaseFunctionsClientMock()

  const result = await httpsCallable().stream({ action: 'get-entry' })

  // Verify: the stream surface exists so a caller that reaches for it does not
  // crash on an undefined method
  expect(result.data).toMatchInlineSnapshot(`
    {
      "action": "get-entry",
    }
  `)
})

it('restores the implementation after a reset', async () => {
  const mock = createFirebaseFunctionsClientMock()

  mock.httpsCallable()

  mock.resetFunctionsMocks()

  const result = await mock.httpsCallable()({ action: 'get-entry' })

  // Verify: the reset clears recorded calls but leaves the mock usable — a
  // suite resetting between tests must not be left with a bare spy
  expect(mock.httpsCallable).toHaveBeenCalledTimes(1)
  expect(result).toMatchInlineSnapshot(`
    {
      "data": {
        "action": "get-entry",
      },
    }
  `)
})
