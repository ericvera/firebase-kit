import { expect, it } from 'vitest'
import { ConnectivityError } from '../connectivity/ConnectivityError.js'
import { ConnectionStatus } from '../connectivity/constants.js'
import type { CreateErrorFunction } from '../types.js'
import { toActionableError } from './toActionableError.js'

const createError: CreateErrorFunction = ({ message, cause, fatal }) =>
  Object.assign(new Error(message), { cause, fatal })

it('returns a connectivity error untouched', () => {
  const connectivityError = new ConnectivityError(ConnectionStatus.Offline)

  const result = toActionableError(
    createError,
    connectivityError,
    'Error calling service',
  )

  // Verify: same instance back, so `instanceof ConnectivityError` and the
  // status the offline UI reads both survive
  expect(result).toBe(connectivityError)
  expect(result).toMatchInlineSnapshot(
    `[ConnectivityError: Connectivity issue: offline]`,
  )
})

it('wraps a plain error as a fatal error carrying the original as cause', () => {
  const original = new Error('Internal error message')

  const result = toActionableError(
    createError,
    original,
    "Error calling service 'fast' action 'get-entry-location'",
  )

  // Verify: the caller's message wins, the original is preserved as `cause`,
  // and the error is marked fatal
  expect(result).toMatchInlineSnapshot(
    `[Error: Error calling service 'fast' action 'get-entry-location']`,
  )
  expect({ cause: result.cause, fatal: (result as { fatal?: boolean }).fatal })
    .toMatchInlineSnapshot(`
      {
        "cause": [Error: Internal error message],
        "fatal": true,
      }
    `)
})

it('wraps a non-Error rejection as a fatal error', () => {
  const result = toActionableError(
    createError,
    'just a string',
    'Error calling service',
  )

  // Verify: a thrown non-Error still becomes a fatal error and is kept as cause
  expect(result).toMatchInlineSnapshot(`[Error: Error calling service]`)
  expect({ cause: result.cause, fatal: (result as { fatal?: boolean }).fatal })
    .toMatchInlineSnapshot(`
      {
        "cause": "just a string",
        "fatal": true,
      }
    `)
})
