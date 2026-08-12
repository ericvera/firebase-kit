import { logger } from 'firebase-functions'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import { FunctionsInternalError } from './FunctionsInternalError.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

const authData = { uid: 'some-uid', token: {} } as AuthData

it('works with no data', () => {
  const error = new FunctionsInternalError(undefined, 'some message 2')
  expect(error).toMatchInlineSnapshot(`[Error: some message 2]`)
  expect(error.code).toMatchInlineSnapshot(`"internal"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[INTERNAL] some message 2 [UNAUTHENTICATED]",
      undefined,
    ]
  `)
})

it('works with data', () => {
  const error = new FunctionsInternalError(authData, 'some message', {
    someData: 'the value',
  })
  expect(error).toMatchInlineSnapshot(`[Error: some message]`)
  expect(error.code).toMatchInlineSnapshot(`"internal"`)
  expect(error.details).toMatchInlineSnapshot(`
    {
      "someData": "the value",
    }
  `)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[INTERNAL] some message [UID: some-uid]",
      {
        "someData": "the value",
      },
    ]
  `)
})
