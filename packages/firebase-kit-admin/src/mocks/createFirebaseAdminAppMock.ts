import type {
  App,
  AppOptions,
  Credential,
  ServiceAccount,
} from 'firebase-admin/app'

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase-admin/app` module, so a bare
 * `vi.mock('firebase-admin/app')` gives tests an in-memory app registry
 * instead of a real Firebase app. Returns the module members the suite needs
 * plus a reset helper.
 */
export const createFirebaseAdminAppMock = () => {
  const apps: App[] = []

  // Recorded so a caller can assert what it initialized with — the app objects
  // alone do not carry the options, and the credential is opaque.
  const initializeAppOptions: (AppOptions | undefined)[] = []
  const certifiedConfigs: (string | ServiceAccount)[] = []

  const getNewApp = (name: string | undefined): App => ({
    name: `test-app-${name ?? String(apps.length)}`,
    options: {},
  })

  // Function to reset the recorded state between tests
  const resetFirebaseAdminAppMocks = () => {
    apps.splice(0, apps.length)
    initializeAppOptions.splice(0, initializeAppOptions.length)
    certifiedConfigs.splice(0, certifiedConfigs.length)
  }

  const cert = (
    serviceAccountPathOrObject: string | ServiceAccount,
  ): Credential => {
    if (typeof serviceAccountPathOrObject === 'string') {
      throw new Error('string parameter not implemented in mock')
    }

    certifiedConfigs.push(serviceAccountPathOrObject)

    return {
      getAccessToken: () =>
        Promise.resolve({
          access_token: `token-for-project-id---${String(serviceAccountPathOrObject.projectId)}`,
          expires_in: 3600,
        }),
    }
  }

  const getApps = () => {
    return apps
  }

  const getApp = () => {
    return apps[0]
  }

  const initializeApp = (options?: AppOptions) => {
    initializeAppOptions.push(options)

    const projectId = options?.projectId

    // Matched on the derived name rather than the raw project id: the two
    // differ by the `test-app-` prefix, so comparing against the id would
    // never find an existing app and every re-initialization would register a
    // duplicate instead of being idempotent like the real SDK. An anonymous
    // initialization has nothing to match on and always registers a new app.
    const existing =
      projectId === undefined
        ? undefined
        : apps.find((app) => app.name === `test-app-${projectId}`)

    if (existing !== undefined) {
      return existing
    }

    const app = getNewApp(options?.projectId)

    apps.push(app)

    return app
  }

  /** Service-account configs `cert` was called with, in call order. */
  const getCertifiedConfigs = () => [...certifiedConfigs]

  /** Options each `initializeApp` was called with, in call order. */
  const getInitializeAppOptions = () => [...initializeAppOptions]

  return {
    cert,
    getApp,
    getApps,
    getCertifiedConfigs,
    getInitializeAppOptions,
    initializeApp,
    resetFirebaseAdminAppMocks,
  }
}
