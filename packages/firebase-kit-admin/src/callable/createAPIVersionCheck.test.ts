import type { AuthData } from 'firebase-functions/tasks'
import { expect, it } from 'vitest'
import type { FunctionsFailedPreconditionError } from '../errors/index.js'
import { createAPIVersionCheck } from './createAPIVersionCheck.js'

const authData = { uid: 'some-uid', token: {} } as AuthData

// Arbitrary server version — the point of every case below is that this bound
// value, and never the per-call minimum, is what the check compares against.
const ServerAPIVersion = 7

const checkAPIVersion = createAPIVersionCheck(ServerAPIVersion)

const catchError = (run: () => unknown): unknown => {
  try {
    run()
  } catch (caught) {
    return caught
  }

  return undefined
}

it('strips the version and returns the rest of the data when the client is in range', () => {
  const result = checkAPIVersion(
    authData,
    { v: 5, entryId: 'entry-1', quantity: 2 },
    3,
  )

  // Verify: a client between the per-call minimum (3) and the bound server
  // version (7) is accepted, and `v` never reaches the handler
  expect(result).toMatchInlineSnapshot(`
    {
      "entryId": "entry-1",
      "quantity": 2,
    }
  `)
})

it('applies the per-call minimum while the bound server version stays fixed', () => {
  const accepted = checkAPIVersion(authData, { v: 4, entryId: 'entry-1' }, 3)

  const error = catchError(() =>
    checkAPIVersion(authData, { v: 4, entryId: 'entry-1' }, 5),
  )

  // Verify: the same bound check accepts version 4 for a handler asking for 3
  // and refuses it for one asking for 5, so the minimum is a call argument
  expect(accepted).toMatchInlineSnapshot(`
    {
      "entryId": "entry-1",
    }
  `)
  expect(error).toMatchInlineSnapshot(
    `[Error: API version too old. Please refresh.]`,
  )
  expect((error as FunctionsFailedPreconditionError).details)
    .toMatchInlineSnapshot(`
      {
        "clientVersion": 4,
        "currentAPIVersion": 7,
        "minVersion": 5,
      }
    `)
})

it('throws when the request carries no version', () => {
  const dataWithoutVersion: { v?: number; entryId: string } = {
    entryId: 'entry-1',
  }

  const error = catchError(() =>
    checkAPIVersion(authData, dataWithoutVersion, 3),
  )

  // Verify: a request with no `v` is refused as `failed-precondition`, with
  // the bound version and the per-call minimum in the details
  expect(error).toMatchInlineSnapshot(
    `[Error: API version missing. Please refresh.]`,
  )
  expect(
    (error as FunctionsFailedPreconditionError).code,
  ).toMatchInlineSnapshot(`"failed-precondition"`)
  expect((error as FunctionsFailedPreconditionError).details)
    .toMatchInlineSnapshot(`
      {
        "clientVersion": "missing",
        "currentAPIVersion": 7,
        "minVersion": 3,
      }
    `)
})

it('accepts a client sitting exactly on the per-call minimum', () => {
  const result = checkAPIVersion(authData, { v: 3, entryId: 'entry-1' }, 3)

  // Verify: the floor is inclusive — a client at exactly the version a handler
  // asks for is in range, not one short of it
  expect(result).toMatchInlineSnapshot(`
    {
      "entryId": "entry-1",
    }
  `)
})

it('throws when the client version is below the per-call minimum', () => {
  const error = catchError(() =>
    checkAPIVersion(authData, { v: 2, entryId: 'entry-1' }, 3),
  )

  // Verify: too-old clients are told to refresh, and the details name both
  // versions so the client can tell this apart from any other failure
  expect(error).toMatchInlineSnapshot(
    `[Error: API version too old. Please refresh.]`,
  )
  expect((error as FunctionsFailedPreconditionError).details)
    .toMatchInlineSnapshot(`
      {
        "clientVersion": 2,
        "currentAPIVersion": 7,
        "minVersion": 3,
      }
    `)
})

it('accepts a client sitting exactly on the bound server version', () => {
  const result = checkAPIVersion(
    authData,
    { v: ServerAPIVersion, entryId: 'entry-1' },
    3,
  )

  // Verify: the ceiling is inclusive — a client running the same version as the
  // server is the normal case and must not be refused
  expect(result).toMatchInlineSnapshot(`
    {
      "entryId": "entry-1",
    }
  `)
})

it('throws when the client version is above the bound server version', () => {
  const error = catchError(() =>
    checkAPIVersion(authData, { v: 8, entryId: 'entry-1' }, 3),
  )

  // Verify: the ceiling is the bound version (7), not the per-call minimum,
  // and the message names it
  expect(error).toMatchInlineSnapshot(
    `[Error: Client API version is unexpectedly bigger than the current server version 7 which is never expected to happen.]`,
  )
  expect((error as FunctionsFailedPreconditionError).details)
    .toMatchInlineSnapshot(`
      {
        "clientVersion": 8,
        "currentAPIVersion": 7,
        "minVersion": 3,
      }
    `)
})
