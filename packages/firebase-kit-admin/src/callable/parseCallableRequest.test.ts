import type { CallableRequest } from 'firebase-functions/https'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it } from 'vitest'
import { parseCallableRequest } from './parseCallableRequest.js'

type TestRequest =
  { action: 'send-order'; entryId: string } | { action: 'check-status' }

const createRequest = (
  data: TestRequest,
  auth: AuthData | undefined,
): CallableRequest<TestRequest> =>
  ({ auth, data, rawRequest: {} }) as CallableRequest<TestRequest>

const authData = { uid: 'some-uid', token: {} } as AuthData

it('splits action off the payload and keeps the remaining fields as data', () => {
  const parsed = parseCallableRequest(
    createRequest({ action: 'send-order', entryId: 'entry-1' }, authData),
  )

  // Verify: auth passes through, action is lifted out, and data holds every
  // remaining field with action stripped
  expect(parsed).toMatchInlineSnapshot(`
    {
      "action": "send-order",
      "auth": {
        "token": {},
        "uid": "some-uid",
      },
      "data": {
        "entryId": "entry-1",
      },
    }
  `)
})

it('produces an empty data object for a payload-free action', () => {
  const parsed = parseCallableRequest(
    createRequest({ action: 'check-status' }, authData),
  )

  // Verify: data is an empty object rather than undefined when action is the
  // only field
  expect(parsed).toMatchInlineSnapshot(`
    {
      "action": "check-status",
      "auth": {
        "token": {},
        "uid": "some-uid",
      },
      "data": {},
    }
  `)
})

it('passes through undefined auth for an unauthenticated request', () => {
  const parsed = parseCallableRequest(
    createRequest({ action: 'send-order', entryId: 'entry-1' }, undefined),
  )

  // Verify: unauthenticated requests are parsed the same way, with auth
  // undefined rather than the call failing
  expect(parsed).toMatchInlineSnapshot(`
    {
      "action": "send-order",
      "auth": undefined,
      "data": {
        "entryId": "entry-1",
      },
    }
  `)
})

it('passes an unknown action through unchanged for the caller to reject', () => {
  const parsed = parseCallableRequest(
    createRequest(
      { action: 'unknown-action' as 'send-order', entryId: 'entry-1' },
      authData,
    ),
  )

  // Verify: the parser does not validate — an unrecognized action reaches the
  // dispatch switch verbatim so the router owns the error
  expect(parsed).toMatchInlineSnapshot(`
    {
      "action": "unknown-action",
      "auth": {
        "token": {},
        "uid": "some-uid",
      },
      "data": {
        "entryId": "entry-1",
      },
    }
  `)
})

it('yields an undefined action when the payload has none', () => {
  const parsed = parseCallableRequest(
    createRequest({ entryId: 'entry-1' } as unknown as TestRequest, authData),
  )

  // Verify: a missing action is not defaulted or thrown on — it surfaces as
  // undefined, which every dispatch switch falls through to its default branch
  expect(parsed).toMatchInlineSnapshot(`
    {
      "action": undefined,
      "auth": {
        "token": {},
        "uid": "some-uid",
      },
      "data": {
        "entryId": "entry-1",
      },
    }
  `)
})
