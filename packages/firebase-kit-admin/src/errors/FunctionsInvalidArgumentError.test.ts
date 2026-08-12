import { logger } from 'firebase-functions'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import { FunctionsInvalidArgumentError } from './FunctionsInvalidArgumentError.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

const authData = { uid: 'some-uid', token: {} } as AuthData

it('works unauthenticated', () => {
  const error = new FunctionsInvalidArgumentError(undefined, 'some message 2')
  expect(error).toMatchInlineSnapshot(`[Error: some message 2]`)
  expect(error.code).toMatchInlineSnapshot(`"invalid-argument"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[INVALID-ARGUMENT] some message 2 [UNAUTHENTICATED]",
      undefined,
    ]
  `)
})

it('works authenticated', () => {
  const error = new FunctionsInvalidArgumentError(authData, 'some message 2')
  expect(error).toMatchInlineSnapshot(`[Error: some message 2]`)
  expect(error.code).toMatchInlineSnapshot(`"invalid-argument"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[INVALID-ARGUMENT] some message 2 [UID: some-uid]",
      undefined,
    ]
  `)
})
