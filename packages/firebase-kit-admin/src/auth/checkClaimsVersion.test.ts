import { getAuth } from 'firebase-admin/auth'
import type { AuthData } from 'firebase-functions/tasks'
import { expect, it, vi } from 'vitest'
import type {
  FunctionsInternalError,
  FunctionsPermissionDeniedError,
} from '../errors/index.js'
import { checkClaimsVersion } from './checkClaimsVersion.js'

interface TestClaims {
  v?: number
  role?: string
}

vi.mock('firebase-admin/auth')
vi.mock('firebase-functions')

const TestUid = 'some-uid'

// Seeded through the real `setCustomUserClaims`, so no case reaches for a
// control the Auth SDK does not have.
const storeClaims = async (claims: TestClaims | undefined) => {
  await getAuth().setCustomUserClaims(TestUid, claims ?? null)
}

// Only `uid` and the token's `v` are read here, so the rest of `AuthData` is
// left out rather than filled with values no case looks at. The double cast is
// what the partial token costs: `{ v }` and `DecodedIdToken` are assignable in
// neither direction, so a single `as AuthData` is rejected as TS2352.
const createAuthData = (tokenVersion: number): AuthData =>
  ({
    uid: TestUid,
    token: { v: tokenVersion },
  }) as unknown as AuthData

const catchRejection = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise
  } catch (caught) {
    return caught
  }

  return undefined
}

it('returns the stored claims when the token version matches', async () => {
  await storeClaims({ v: 3, role: 'owner' })

  const claims = await checkClaimsVersion<TestClaims>(createAuthData(3))

  // Verify: the claims come back so the caller can run its own role checks
  // without a second Auth round-trip
  expect(claims).toMatchInlineSnapshot(`
    {
      "role": "owner",
      "v": 3,
    }
  `)
})

it('rejects a token whose version is behind the stored claims', async () => {
  await storeClaims({ v: 4 })

  const error = await catchRejection(
    checkClaimsVersion<TestClaims>(createAuthData(3)),
  )

  // Verify: a stale token is refused, which is the signal the client uses to
  // force a refresh and retry
  expect(error).toMatchInlineSnapshot(
    `[Error: User claims version does not match the token]`,
  )
  expect((error as FunctionsPermissionDeniedError).code).toMatchInlineSnapshot(
    `"permission-denied"`,
  )
})

it('rejects a token whose version is ahead of the stored claims', async () => {
  await storeClaims({ v: 2 })

  const error = await catchRejection(
    checkClaimsVersion<TestClaims>(createAuthData(3)),
  )

  // Verify: refused in this direction too — a token claiming a version the
  // stored claims never reached cannot be trusted
  expect(error).toMatchInlineSnapshot(
    `[Error: User claims version does not match the token]`,
  )
})

it('rejects when the user has no stored claims at all', async () => {
  await storeClaims(undefined)

  const error = await catchRejection(
    checkClaimsVersion<TestClaims>(createAuthData(3)),
  )

  // Verify: absent claims are a mismatch rather than a pass, so a user whose
  // claims were never written cannot slip through
  expect(error).toMatchInlineSnapshot(
    `[Error: User claims version does not match the token]`,
  )
})

it('throws when the request carries no uid', async () => {
  const error = await catchRejection(checkClaimsVersion<TestClaims>(undefined))

  // Verify: an authorized handler reaching here without a uid is a wiring
  // fault, not a permission decision, so it surfaces as internal
  expect(error).toMatchInlineSnapshot(`[Error: User unexpectedly not found]`)
  expect((error as FunctionsInternalError).code).toMatchInlineSnapshot(
    `"internal"`,
  )
})
