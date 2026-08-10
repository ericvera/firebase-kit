import { expect, it } from 'vitest'
import { createFirebaseAdminAppMock } from './createFirebaseAdminAppMock.js'

it('registers an app on first initialization', () => {
  const mock = createFirebaseAdminAppMock()

  const app = mock.initializeApp({ projectId: 'demo-app' })

  // Verify: the app is named after the project it was initialized with, so a
  // test can tell two initializations apart
  expect(app.name).toEqual('test-app-demo-app')
  expect(mock.getApps()).toHaveLength(1)
})

it('returns the existing app when initialized again with the same project', () => {
  const mock = createFirebaseAdminAppMock()

  const first = mock.initializeApp({ projectId: 'demo-app' })
  const second = mock.initializeApp({ projectId: 'demo-app' })

  // Verify: re-initialization is idempotent, matching the real SDK — an init
  // helper called twice must not register a duplicate
  expect(second).toBe(first)
  expect(mock.getApps()).toHaveLength(1)
})

it('registers a separate app per project id', () => {
  const mock = createFirebaseAdminAppMock()

  mock.initializeApp({ projectId: 'demo-app' })
  mock.initializeApp({ projectId: 'demo-other' })

  // Verify: the registry is keyed by project, so a suite exercising two
  // environments sees both
  expect(mock.getApps()).toHaveLength(2)
})

it('reports the first registered app as the default', () => {
  const mock = createFirebaseAdminAppMock()

  const first = mock.initializeApp({ projectId: 'demo-app' })

  mock.initializeApp({ projectId: 'demo-other' })

  // Verify: getApp() means "the default app", which is the one registered first
  expect(mock.getApp()).toBe(first)
})

it('builds a credential that names the project it was certified for', async () => {
  const mock = createFirebaseAdminAppMock()

  const credential = mock.cert({ projectId: 'demo-app' })

  const token = await credential.getAccessToken()

  // Verify: the token identifies its project, so a test asserting which service
  // account was used has something to read
  expect(token.access_token).toEqual('token-for-project-id---demo-app')
})

it('refuses a credential built from a file path', () => {
  const mock = createFirebaseAdminAppMock()

  // Verify: the path form is not implemented, and says so rather than silently
  // producing a credential for the wrong project
  expect(() =>
    mock.cert('/path/to/credentials.json'),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: string parameter not implemented in mock]`,
  )
})

it('empties the registry on reset', () => {
  const mock = createFirebaseAdminAppMock()

  mock.initializeApp({ projectId: 'demo-app' })

  mock.resetFirebaseAdminAppMocks()

  // Verify: one test's app cannot make the next test's initialization look like
  // a re-initialization
  expect(mock.getApps()).toEqual([])
})

it('records the options each initialization was made with', () => {
  const mock = createFirebaseAdminAppMock()

  mock.initializeApp({ projectId: 'demo-app' })
  mock.initializeApp({ projectId: 'demo-other', storageBucket: 'bucket' })

  // Verify: the app objects alone do not carry the options, so a caller
  // asserting on how it initialized has nothing else to read
  expect(mock.getInitializeAppOptions()).toMatchInlineSnapshot(`
    [
      {
        "projectId": "demo-app",
      },
      {
        "projectId": "demo-other",
        "storageBucket": "bucket",
      },
    ]
  `)
})

it('records the service account each credential was built from', () => {
  const mock = createFirebaseAdminAppMock()

  mock.cert({ projectId: 'demo-app' })

  // Verify: the credential the caller receives is opaque, so which account it
  // certified is only visible here
  expect(mock.getCertifiedConfigs()).toMatchInlineSnapshot(`
    [
      {
        "projectId": "demo-app",
      },
    ]
  `)
})

it('clears the recorded options and credentials on reset', () => {
  const mock = createFirebaseAdminAppMock()

  mock.initializeApp({ projectId: 'demo-app' })
  mock.cert({ projectId: 'demo-app' })

  mock.resetFirebaseAdminAppMocks()

  // Verify: one test's initialization cannot show up in the next one's
  // assertions
  expect(mock.getInitializeAppOptions()).toEqual([])
  expect(mock.getCertifiedConfigs()).toEqual([])
})
