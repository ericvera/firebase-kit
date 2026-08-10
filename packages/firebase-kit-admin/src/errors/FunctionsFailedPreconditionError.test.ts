import { logger } from 'firebase-functions'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import { FunctionsFailedPreconditionError } from './FunctionsFailedPreconditionError.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

const authData = {
  uid: 'some-uid',
  token: {},
} as AuthData

it('works without authentication', () => {
  const error = new FunctionsFailedPreconditionError(
    undefined,
    'Precondition failed message',
  )
  expect(error).toMatchInlineSnapshot(`[Error: Precondition failed message]`)
  expect(error.code).toMatchInlineSnapshot(`"failed-precondition"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})

it('works with authentication', () => {
  const error = new FunctionsFailedPreconditionError(
    authData,
    'Version mismatch',
  )
  expect(error).toMatchInlineSnapshot(`[Error: Version mismatch]`)
  expect(error.code).toMatchInlineSnapshot(`"failed-precondition"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})

it('works with details', () => {
  const error = new FunctionsFailedPreconditionError(
    authData,
    'API version too old',
    { currentAPIVersion: 10, minVersion: 5, clientVersion: 3 },
  )
  expect(error).toMatchInlineSnapshot(`[Error: API version too old]`)
  expect(error.code).toMatchInlineSnapshot(`"failed-precondition"`)
  expect(error.details).toMatchInlineSnapshot(`
    {
      "clientVersion": 3,
      "currentAPIVersion": 10,
      "minVersion": 5,
    }
  `)

  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})
