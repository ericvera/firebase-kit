import { vi } from 'vitest'

/** The parts of an Auth user record these doubles serve back. */
export interface MockUserRecord {
  uid: string
  customClaims?: Record<string, unknown> | undefined
  email?: string | undefined
}

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase-admin/auth` module, so a bare
 * `vi.mock('firebase-admin/auth')` reads users out of an in-memory directory
 * instead of Firebase Auth.
 *
 * A test seeds it through the real `setCustomUserClaims`, or through `setUser`
 * where an alias makes the shim's own exports reachable. An unseeded uid
 * rejects the way the real SDK does, so the not-found path needs no second
 * double.
 */
export const createFirebaseAdminAuthMock = () => {
  const users = new Map<string, MockUserRecord>()

  let requestedUids: string[] = []

  const getUser = (uid: string): Promise<MockUserRecord> => {
    requestedUids.push(uid)

    const user = users.get(uid)

    if (user === undefined) {
      return Promise.reject(
        Object.assign(new Error(`There is no user record for uid ${uid}`), {
          code: 'auth/user-not-found',
        }),
      )
    }

    return Promise.resolve(user)
  }

  const setCustomUserClaims = (
    uid: string,
    customClaims: object | null,
  ): Promise<void> => {
    users.set(uid, {
      ...users.get(uid),
      uid,
      customClaims: (customClaims ?? undefined) as
        Record<string, unknown> | undefined,
    })

    return Promise.resolve()
  }

  const auth = { getUser, setCustomUserClaims }

  const getAuth = vi.fn(() => auth)

  /** Seeds the directory with a user the subject can look up. */
  const setUser = (user: MockUserRecord) => {
    users.set(user.uid, user)
  }

  /** Every uid the subject asked for, in call order. */
  const getRequestedUids = () => [...requestedUids]

  const resetFirebaseAdminAuthMock = () => {
    users.clear()
    requestedUids = []
    getAuth.mockClear()
    getAuth.mockImplementation(() => auth)
  }

  return {
    getAuth,
    getRequestedUids,
    resetFirebaseAdminAuthMock,
    setUser,
  }
}
