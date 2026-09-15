import type { AppCheck } from 'firebase/app-check'
import { getToken } from 'firebase/app-check'
import type { Auth, User } from 'firebase/auth'
import { beforeEach, expect, it, vi } from 'vitest'
import { getTokenHeaders } from './getTokenHeaders.js'

// The shim in `src/__mocks__/firebase/app-check` stands in for the token
// exchange, which vitest applies to a node_modules package only on request.
vi.mock('firebase/app-check')

const appCheck = {} as unknown as AppCheck

const createUser = (token: string | Error): User =>
  ({
    getIdToken: () =>
      token instanceof Error ? Promise.reject(token) : Promise.resolve(token),
  }) as unknown as User

const createAuth = (currentUser: User | null): Auth =>
  ({
    authStateReady: () => Promise.resolve(),
    currentUser,
  }) as unknown as Auth

// `mockReset` clears the shim's implementation between tests, so the token
// every case starts from is set here.
beforeEach(() => {
  vi.mocked(getToken).mockResolvedValue({ token: 'app-check-token' })
})

it('returns both headers when both tokens resolve', async () => {
  const headers = await getTokenHeaders(
    createAuth(createUser('id-token')),
    appCheck,
  )

  // Verify: bearer auth header and App Check header
  expect(headers).toMatchInlineSnapshot(`
    {
      "Authorization": "Bearer id-token",
      "X-Firebase-AppCheck": "app-check-token",
    }
  `)
})

it('omits the auth header when nobody is signed in', async () => {
  const headers = await getTokenHeaders(createAuth(null), appCheck)

  // Verify: App Check only
  expect(headers).toMatchInlineSnapshot(`
    {
      "X-Firebase-AppCheck": "app-check-token",
    }
  `)
})

it('returns no headers and never asks App Check when neither is supplied', async () => {
  const headers = await getTokenHeaders(undefined, undefined)

  // Verify: empty record, getToken untouched
  expect({
    headers,
    getTokenCalls: vi.mocked(getToken).mock.calls.length,
  }).toMatchInlineSnapshot(`
    {
      "getTokenCalls": 0,
      "headers": {},
    }
  `)
})

it('omits the auth header when the ID token cannot be refreshed', async () => {
  const headers = await getTokenHeaders(
    createAuth(createUser(new Error('token refresh failed'))),
    appCheck,
  )

  // Verify: App Check survives an auth failure
  expect(headers).toMatchInlineSnapshot(`
    {
      "X-Firebase-AppCheck": "app-check-token",
    }
  `)
})

it('omits the App Check header when the attestation exchange fails', async () => {
  vi.mocked(getToken).mockRejectedValue(new Error('attestation failed'))

  const headers = await getTokenHeaders(
    createAuth(createUser('id-token')),
    appCheck,
  )

  // Verify: auth survives an App Check failure
  expect(headers).toMatchInlineSnapshot(`
    {
      "Authorization": "Bearer id-token",
    }
  `)
})

it('sends an App Check header even when the token is empty', async () => {
  vi.mocked(getToken).mockResolvedValue({ token: '' })

  const headers = await getTokenHeaders(undefined, appCheck)

  // Verify: empty attestation still sent, as the SDK sends it
  expect(headers).toMatchInlineSnapshot(`
    {
      "X-Firebase-AppCheck": "",
    }
  `)
})

it('waits for authStateReady before reading the current user', async () => {
  const order: string[] = []
  let currentUser: User | null = null

  // The user only appears once `authStateReady` has resolved, so a token in
  // the header proves the wait happened.
  const auth = {
    authStateReady: async () => {
      order.push('authStateReady')

      await Promise.resolve()

      currentUser = createUser('restored-token')
    },
    get currentUser(): User | null {
      order.push('currentUser')

      return currentUser
    },
  } as unknown as Auth

  const headers = await getTokenHeaders(auth, undefined)

  // Verify: authStateReady read first, restored user's token sent
  expect({ headers, order }).toMatchInlineSnapshot(`
    {
      "headers": {
        "Authorization": "Bearer restored-token",
      },
      "order": [
        "authStateReady",
        "currentUser",
      ],
    }
  `)
})
