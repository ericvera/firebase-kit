import { logger } from 'firebase-functions'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import { FunctionsPermissionDeniedError } from './FunctionsPermissionDeniedError.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

const authData = { uid: 'some-uid', token: {} } as AuthData

it('works unauthenticated', () => {
  const error = new FunctionsPermissionDeniedError(undefined, 'some message 2')
  expect(error).toMatchInlineSnapshot(`[Error: some message 2]`)
  expect(error.code).toMatchInlineSnapshot(`"permission-denied"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[PERMISSION-DENIED] some message 2 [UNAUTHENTICATED]",
      undefined,
    ]
  `)
})

it('works authenticated', () => {
  const error = new FunctionsPermissionDeniedError(authData, 'some message')
  expect(error).toMatchInlineSnapshot(`[Error: some message]`)
  expect(error.code).toMatchInlineSnapshot(`"permission-denied"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[PERMISSION-DENIED] some message [UID: some-uid]",
      undefined,
    ]
  `)
})
