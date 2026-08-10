import type { AuthData } from 'firebase-functions/tasks'
import { expect, it } from 'vitest'
import type { FunctionsUnauthenticatedError } from '../errors/index.js'
import { checkAuthenticated } from './checkAuthenticated.js'

const authData = { uid: 'some-uid', token: {} } as AuthData

it('returns the request auth under authData', () => {
  const result = checkAuthenticated(authData)

  // Verify: the plain form returns only `authData`, carrying the same auth
  // object through so downstream checks read the caller's uid and token
  expect(result).toMatchInlineSnapshot(`
    {
      "authData": {
        "token": {},
        "uid": "some-uid",
      },
    }
  `)
  expect(result.authData).toBe(authData)
})

it('throws when the request carries no auth', () => {
  let error: unknown

  try {
    checkAuthenticated(undefined)
  } catch (caught) {
    error = caught
  }

  // Verify: anonymous callers are refused with the `unauthenticated` wire code,
  // which is what the client turns into a sign-in prompt
  expect(error).toMatchInlineSnapshot(`[Error: User not authenticated.]`)
  expect((error as FunctionsUnauthenticatedError).code).toMatchInlineSnapshot(
    `"unauthenticated"`,
  )
})
