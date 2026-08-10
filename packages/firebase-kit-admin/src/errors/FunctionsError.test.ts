import { logger } from 'firebase-functions'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import { FunctionsError } from './FunctionsError.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

const authData = {
  uid: 'some-uid',
  token: {},
} as AuthData

it('works when message should not be logged', () => {
  const error = new FunctionsError(
    'internal',
    undefined,
    'some message 2',
    false,
  )
  expect(error).toMatchInlineSnapshot(`[Error: some message 2]`)
  expect(error.code).toMatchInlineSnapshot(`"internal"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})

it('works when message should be logged', () => {
  const error = new FunctionsError(
    'already-exists',
    undefined,
    'some message',
    true,
  )
  expect(error).toMatchInlineSnapshot(`[Error: some message]`)
  expect(error.code).toMatchInlineSnapshot(`"already-exists"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[ALREADY-EXISTS] some message [UNAUTHENTICATED]",
      undefined,
    ]
  `)
})

it('works when authenticated and with data', () => {
  const error = new FunctionsError(
    'unauthenticated',
    authData,
    'some message 8',
    true,
    { some: 'data' },
  )
  expect(error).toMatchInlineSnapshot(`[Error: some message 8]`)
  expect(error.code).toMatchInlineSnapshot(`"unauthenticated"`)
  expect(error.details).toMatchInlineSnapshot(`
    {
      "some": "data",
    }
  `)

  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[UNAUTHENTICATED] some message 8 [UID: some-uid]",
      {
        "some": "data",
      },
    ]
  `)
})
