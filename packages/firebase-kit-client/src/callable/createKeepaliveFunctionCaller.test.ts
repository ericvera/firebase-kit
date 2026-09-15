import { initializeApp } from 'firebase/app'
import type { AppCheck } from 'firebase/app-check'
import { getToken } from 'firebase/app-check'
import type { Auth, User } from 'firebase/auth'
import type { Functions } from 'firebase/functions'
import { getFunctions } from 'firebase/functions'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getErrorWithCode } from '../getErrorWithCode.js'
import { RateLimitError } from '../rate-limit/RateLimitError.js'
import { KeepaliveCallError } from './KeepaliveCallError.js'
import { createKeepaliveFunctionCaller } from './createKeepaliveFunctionCaller.js'
import type {
  KeepaliveFunctionCallerDependencies,
  KeepaliveFunctionCallerOptions,
  RequestResponseMap,
} from './types.js'

const state = vi.hoisted(
  (): {
    rateLimitChecks: { functionName: string; category: string }[]
  } => ({
    rateLimitChecks: [],
  }),
)

// The shim in `src/__mocks__/firebase/functions` counts instance lookups on the
// real SDK, which vitest applies to a node_modules package only on request.
vi.mock('firebase/functions')

// The shim in `src/__mocks__/firebase/app-check` stands in for the token
// exchange, which vitest applies to a node_modules package only on request.
vi.mock('firebase/app-check')

type TestCommand = 'get-entry' | 'send-beacon'

type TestCategory = 'default' | 'low-frequency'

// Extends the map type rather than restating its shape: the rule against a
// type alias here wants an interface, and an interface only satisfies the
// caller's `TMap` constraint when it inherits the index signature.
interface TestMap extends RequestResponseMap {
  'get-entry': [{ entryId: string; note?: string | undefined }, undefined]
  'send-beacon': [{ payload: string }, undefined]
}

interface RecordedRequest {
  url: string
  init: RequestInit
}

interface FetchOutcome {
  ok: boolean
  status: number
  json?: () => Promise<unknown>
}

interface FakeFunctionsShape {
  projectId?: string | undefined
  region?: string
  customDomain?: string | null
}

// Structural rather than a real instance, because the caller reads only
// `app.options.projectId`, `region` and `customDomain` off it.
const createTestFunctions = ({
  projectId = 'demo-keepalive',
  region = 'us-central1',
  customDomain = 'https://functions.test',
}: FakeFunctionsShape = {}): Functions => ({
  app: {
    name: 'keepalive-fake',
    options: { projectId },
    automaticDataCollectionEnabled: false,
  },
  region,
  customDomain,
})

const appCheck = {} as unknown as AppCheck

const createAuth = (idToken: string | undefined): Auth =>
  ({
    authStateReady: () => Promise.resolve(),
    currentUser:
      idToken === undefined
        ? null
        : ({ getIdToken: () => Promise.resolve(idToken) } as unknown as User),
  }) as unknown as Auth

/**
 * Stands in for global `fetch`. Records the URL and the whole init object, and
 * lets a test set the outcome after `beforeEach` has installed it.
 */
const createFetchRecorder = () => {
  const requests: RecordedRequest[] = []
  const json = vi.fn((): Promise<unknown> => Promise.resolve(null))

  let outcome = { ok: true, status: 200 }
  let rejection: Error | undefined

  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    requests.push({ url, init })

    if (rejection !== undefined) {
      return Promise.reject(rejection)
    }

    return Promise.resolve({ ...outcome, json })
  })

  return {
    requests,
    json,
    setOutcome: (next: FetchOutcome) => {
      outcome = { ok: next.ok, status: next.status }

      if (next.json !== undefined) {
        json.mockImplementation(next.json)
      }
    },
    setRejection: (error: Error) => {
      rejection = error
    },
  }
}

let recorder: ReturnType<typeof createFetchRecorder>
let errors: Error[]

const createDependencies = (
  overrides: Partial<KeepaliveFunctionCallerDependencies<TestCategory>> = {},
): KeepaliveFunctionCallerDependencies<TestCategory> => ({
  currentAPIVersion: 42,
  checkRateLimit: (functionName, category) => {
    state.rateLimitChecks.push({ functionName, category })
  },
  firebaseApp: undefined,
  functions: undefined,
  auth: undefined,
  appCheck: undefined,
  emulator: undefined,
  ...overrides,
})

const createCall = (
  overrides: Partial<KeepaliveFunctionCallerDependencies<TestCategory>> = {},
  options: KeepaliveFunctionCallerOptions<TestCategory, TestCommand> = {
    onError: (error) => {
      errors.push(error)
    },
  },
) =>
  createKeepaliveFunctionCaller<TestCommand, TestMap, TestCategory>(
    createDependencies(overrides),
    'beacons',
    'default',
    options,
  )

// Options omitted, the shape an app with nowhere to report writes.
const createSilentCall = (
  overrides: Partial<KeepaliveFunctionCallerDependencies<TestCategory>> = {},
) =>
  createKeepaliveFunctionCaller<TestCommand, TestMap, TestCategory>(
    createDependencies(overrides),
    'beacons',
    'default',
  )

const waitForRequest = () =>
  vi.waitFor(() => {
    expect(recorder.requests).toHaveLength(1)
  })

const waitForError = () =>
  vi.waitFor(() => {
    expect(errors).toHaveLength(1)
  })

// Long enough for every pending microtask and timer to run before asserting
// that nothing happened.
const flushAsync = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

// The body as sent, or an empty string when nothing was sent.
const getSentBody = (): string => {
  const body = recorder.requests[0]?.init.body

  return typeof body === 'string' ? body : ''
}

const getReportedError = () => {
  const [error] = errors

  return {
    isKeepaliveCallError: error instanceof KeepaliveCallError,
    message: error?.message,
    code: error instanceof KeepaliveCallError ? error.code : undefined,
    status: error instanceof KeepaliveCallError ? error.status : undefined,
    cause: error?.cause,
  }
}

beforeEach(() => {
  recorder = createFetchRecorder()
  errors = []
  state.rateLimitChecks = []

  // `mockReset` clears the shim's implementation between tests, so the token
  // every case starts from is set here.
  vi.mocked(getToken).mockResolvedValue({ token: 'app-check-token' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('sends the call to the URL the SDK derives from the host app', async () => {
  const app = initializeApp({ projectId: 'demo-keepalive' }, 'keepalive-app')

  const call = createCall({ firebaseApp: app })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: instance resolved from the host app, POST, JSON envelope, no
  // token headers, keepalive true
  expect({
    resolvedInstances: vi.mocked(getFunctions).mock.calls.length,
    request: recorder.requests[0],
  }).toMatchInlineSnapshot(`
    {
      "request": {
        "init": {
          "body": "{"data":{"entryId":"entry-1","action":"get-entry","v":42}}",
          "headers": {
            "Content-Type": "application/json",
          },
          "keepalive": true,
          "method": "POST",
        },
        "url": "https://us-central1-demo-keepalive.cloudfunctions.net/beacons",
      },
      "resolvedInstances": 1,
    }
  `)
})

it('uses the Functions instance the host supplies without resolving another', async () => {
  const app = initializeApp({ projectId: 'demo-keepalive' }, 'keepalive-region')
  const functions = getFunctions(app, 'europe-west1')

  const call = createCall({ firebaseApp: app, functions })

  // The setup call above is the host's own, so only what the caller does next
  // counts.
  vi.mocked(getFunctions).mockClear()

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: supplied instance used, getFunctions not called
  expect({
    resolvedInstances: vi.mocked(getFunctions).mock.calls.length,
    url: recorder.requests[0]?.url,
  }).toMatchInlineSnapshot(`
    {
      "resolvedInstances": 0,
      "url": "https://europe-west1-demo-keepalive.cloudfunctions.net/beacons",
    }
  `)
})

it('sends to the custom domain the Functions instance carries', async () => {
  const app = initializeApp({ projectId: 'demo-keepalive' }, 'keepalive-domain')
  const functions = getFunctions(app, 'https://api.example.com')

  const call = createCall({ functions })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: a custom domain replaces the cloudfunctions.net host entirely
  expect(recorder.requests[0]?.url).toMatchInlineSnapshot(
    `"https://api.example.com/beacons"`,
  )
})

it('sends to the emulator the dependencies name without asking for credentials', async () => {
  const app = initializeApp({ projectId: 'demo-keepalive' }, 'keepalive-local')

  const call = createCall({
    functions: getFunctions(app),
    emulator: { host: 'localhost', port: 5001 },
  })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: emulator URL with project and region, no credentials key
  expect({
    url: recorder.requests[0]?.url,
    hasCredentials: 'credentials' in (recorder.requests[0]?.init ?? {}),
  }).toMatchInlineSnapshot(`
    {
      "hasCredentials": false,
      "url": "http://localhost:5001/demo-keepalive/us-central1/beacons",
    }
  `)
})

it('asks for credentials when the emulator is a Cloud Workstation', async () => {
  const app = initializeApp(
    { projectId: 'demo-keepalive' },
    'keepalive-workstation',
  )

  const call = createCall({
    functions: getFunctions(app),
    emulator: { host: 'demo.cloudworkstations.dev', port: 5001 },
  })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: https emulator URL and credentials include
  expect({
    url: recorder.requests[0]?.url,
    credentials: recorder.requests[0]?.init.credentials,
  }).toMatchInlineSnapshot(`
    {
      "credentials": "include",
      "url": "https://demo.cloudworkstations.dev:5001/demo-keepalive/us-central1/beacons",
    }
  `)
})

it('sends the payload with the action and the bound API version', async () => {
  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: `{ data }` envelope with the payload, action and v
  expect(JSON.parse(getSentBody())).toMatchInlineSnapshot(`
    {
      "data": {
        "action": "get-entry",
        "entryId": "entry-1",
        "v": 42,
      },
    }
  `)
})

it('drops undefined payload keys rather than sending them', async () => {
  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1', note: undefined })
  await waitForRequest()

  // Verify: `note` absent from the body text
  expect(recorder.requests[0]?.init.body).toMatchInlineSnapshot(
    `"{"data":{"entryId":"entry-1","action":"get-entry","v":42}}"`,
  )
})

it('sends the auth and App Check headers the supplied instances yield', async () => {
  const call = createCall({
    functions: createTestFunctions(),
    auth: createAuth('id-token'),
    appCheck,
  })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: Authorization and X-Firebase-AppCheck alongside the content type
  expect(recorder.requests[0]?.init.headers).toMatchInlineSnapshot(`
    {
      "Authorization": "Bearer id-token",
      "Content-Type": "application/json",
      "X-Firebase-AppCheck": "app-check-token",
    }
  `)
})

it('sends only the content type when neither auth nor App Check is supplied', async () => {
  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: no token headers, App Check never asked
  expect({
    headers: recorder.requests[0]?.init.headers,
    appCheckCalls: vi.mocked(getToken).mock.calls.length,
  }).toMatchInlineSnapshot(`
    {
      "appCheckCalls": 0,
      "headers": {
        "Content-Type": "application/json",
      },
    }
  `)
})

it('never asks App Check for a token when no instance is supplied', async () => {
  const call = createCall({
    functions: createTestFunctions(),
    auth: createAuth('id-token'),
  })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: Authorization present, getToken untouched
  expect({
    headers: recorder.requests[0]?.init.headers,
    appCheckCalls: vi.mocked(getToken).mock.calls.length,
  }).toMatchInlineSnapshot(`
    {
      "appCheckCalls": 0,
      "headers": {
        "Authorization": "Bearer id-token",
        "Content-Type": "application/json",
      },
    }
  `)
})

it('checks the rate limit under the group and action with the default category', async () => {
  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: the budget key names the group and the action, so two actions of
  // one group never share a budget
  expect(state.rateLimitChecks).toMatchInlineSnapshot(`
    [
      {
        "category": "default",
        "functionName": "beacons:get-entry",
      },
    ]
  `)
})

it('checks the rate limit with the per-action category when the map names one', async () => {
  const call = createCall(
    { functions: createTestFunctions() },
    { rateLimitMap: { 'get-entry': 'low-frequency' } },
  )

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()

  // Verify: a mapped action takes its own category instead of the group
  // default
  expect(state.rateLimitChecks).toMatchInlineSnapshot(`
    [
      {
        "category": "low-frequency",
        "functionName": "beacons:get-entry",
      },
    ]
  `)
})

it('reports the limiter error untouched when the rate limit rejects the call', async () => {
  const app = initializeApp(
    { projectId: 'demo-keepalive' },
    'keepalive-limited',
  )

  // The Functions instance and App Check are left to be resolved, so their
  // untouched counters show the check runs before either one.
  const call = createCall({
    firebaseApp: app,
    functions: undefined,
    appCheck,
    checkRateLimit: (functionName) => {
      throw new RateLimitError(functionName, 5, 60_000, 6)
    },
  })

  call('get-entry', { entryId: 'entry-1' })
  await waitForError()

  // Verify: the limiter's own error reaches onError with its code, nothing
  // resolved, nothing sent
  expect({
    isRateLimitError: errors[0] instanceof RateLimitError,
    code: getErrorWithCode(errors[0]).code,
    requests: recorder.requests.length,
    resolvedInstances: vi.mocked(getFunctions).mock.calls.length,
    appCheckCalls: vi.mocked(getToken).mock.calls.length,
  }).toMatchInlineSnapshot(`
    {
      "appCheckCalls": 0,
      "code": "client/rate-limit-exceeded",
      "isRateLimitError": true,
      "requests": 0,
      "resolvedInstances": 0,
    }
  `)
})

it('reports an app with no project id instead of sending', async () => {
  const app = initializeApp({}, 'keepalive-no-project')

  const call = createCall({ functions: getFunctions(app) })

  call('get-entry', { entryId: 'entry-1' })
  await waitForError()

  // Verify: KeepaliveCallError naming the missing option, nothing sent
  expect({
    ...getReportedError(),
    requests: recorder.requests.length,
  }).toMatchInlineSnapshot(`
    {
      "cause": undefined,
      "code": undefined,
      "isKeepaliveCallError": true,
      "message": "Keepalive call to 'beacons' cannot build its URL because the Firebase app has no 'app.options.projectId'.",
      "requests": 0,
      "status": undefined,
    }
  `)
})

it('reports a missing Functions instance when the SDK cannot resolve one', async () => {
  // Every app in this file is named, so there is no default app for
  // `getFunctions` to fall back to.
  const call = createCall()

  call('get-entry', { entryId: 'entry-1' })
  await waitForError()

  // Verify: KeepaliveCallError naming both dependencies, SDK error as cause
  expect({
    isKeepaliveCallError: errors[0] instanceof KeepaliveCallError,
    message: errors[0]?.message,
    causeMessage:
      errors[0]?.cause instanceof Error ? errors[0].cause.message : undefined,
    requests: recorder.requests.length,
  }).toMatchInlineSnapshot(`
    {
      "causeMessage": "Firebase: No Firebase App '[DEFAULT]' has been created - call initializeApp() first (app/no-app).",
      "isKeepaliveCallError": true,
      "message": "Keepalive call to 'beacons' has no Functions instance. Pass 'functions' or 'firebaseApp' in the dependencies.",
      "requests": 0,
    }
  `)
})

it('reports a body over the keepalive limit without sending it', async () => {
  // App Check is supplied so the untouched recorder shows the size guard runs
  // before any token round trip.
  const call = createCall({ functions: createTestFunctions(), appCheck })

  call('send-beacon', { payload: 'x'.repeat(70000) })
  await waitForError()

  // Verify: oversized body reported with size and limit, nothing sent, no
  // token lookup
  expect({
    ...getReportedError(),
    requests: recorder.requests.length,
    appCheckCalls: vi.mocked(getToken).mock.calls.length,
  }).toMatchInlineSnapshot(`
    {
      "appCheckCalls": 0,
      "cause": undefined,
      "code": undefined,
      "isKeepaliveCallError": true,
      "message": "Keepalive call to 'beacons' action 'send-beacon' has a body of 70053 bytes, over the 65536 byte keepalive limit.",
      "requests": 0,
      "status": undefined,
    }
  `)
})

it('sends a body that fits just under the keepalive limit', async () => {
  const call = createCall({ functions: createTestFunctions() })

  call('send-beacon', { payload: 'x'.repeat(65000) })
  await waitForRequest()

  // Verify: a body under the limit is sent
  expect({
    bodyBytes: new TextEncoder().encode(getSentBody()).byteLength,
    errors: errors.length,
  }).toMatchInlineSnapshot(`
    {
      "bodyBytes": 65053,
      "errors": 0,
    }
  `)
})

it('reports a failed fetch with the rejection as its cause', async () => {
  const networkFailure = new Error('network error')
  recorder.setRejection(networkFailure)

  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1' })
  await waitForError()

  // Verify: fetch rejection wrapped with the group name, original as cause
  expect(getReportedError()).toMatchInlineSnapshot(`
    {
      "cause": [Error: network error],
      "code": undefined,
      "isKeepaliveCallError": true,
      "message": "Keepalive call to 'beacons' failed",
      "status": undefined,
    }
  `)
})

it('reports a non-2xx response as a callable error with its code and status', async () => {
  recorder.setOutcome({
    ok: false,
    status: 400,
    json: () =>
      Promise.resolve({
        error: {
          status: 'FAILED_PRECONDITION',
          message: 'API version missing',
        },
      }),
  })

  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1' })
  await waitForError()

  // Verify: envelope decoded to code, status, message and details
  expect(getReportedError()).toMatchInlineSnapshot(`
    {
      "cause": undefined,
      "code": "functions/failed-precondition",
      "isKeepaliveCallError": true,
      "message": "API version missing",
      "status": 400,
    }
  `)
})

it('reports a non-2xx response whose body is not JSON from its status', async () => {
  recorder.setOutcome({
    ok: false,
    status: 401,
    json: () => Promise.reject(new Error('unexpected end of JSON input')),
  })

  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1' })
  await waitForError()

  // Verify: code from the status when the body is not JSON
  expect(getReportedError()).toMatchInlineSnapshot(`
    {
      "cause": undefined,
      "code": "functions/unauthenticated",
      "isKeepaliveCallError": true,
      "message": "unauthenticated",
      "status": 401,
    }
  `)
})

it('leaves a successful response body unread', async () => {
  const call = createCall({ functions: createTestFunctions() })

  call('get-entry', { entryId: 'entry-1' })
  await waitForRequest()
  await flushAsync()

  // Verify: successful response body never read, onError not called
  expect({
    bodyReads: recorder.json.mock.calls.length,
    errors: errors.length,
  }).toMatchInlineSnapshot(`
    {
      "bodyReads": 0,
      "errors": 0,
    }
  `)
})

it('swallows a failure thrown by onError', async () => {
  recorder.setRejection(new Error('network error'))

  let reports = 0

  const call = createCall(
    { functions: createTestFunctions() },
    {
      onError: () => {
        reports += 1

        throw new Error('reporting failed')
      },
    },
  )

  call('get-entry', { entryId: 'entry-1' })

  await waitForRequest()
  await flushAsync()

  // Verify: onError called, its throw swallowed
  expect(reports).toMatchInlineSnapshot(`1`)
})

it('stays silent when no onError is given', async () => {
  recorder.setRejection(new Error('network error'))

  const call = createSilentCall({ functions: createTestFunctions() })

  call('send-beacon', { payload: 'x'.repeat(70000) })
  call('get-entry', { entryId: 'entry-1' })

  await waitForRequest()
  await flushAsync()

  // Verify: guard and network failures complete quietly with no onError
  expect({
    requests: recorder.requests.length,
    errors: errors.length,
  }).toMatchInlineSnapshot(`
    {
      "errors": 0,
      "requests": 1,
    }
  `)
})

it('returns undefined rather than a promise to await', async () => {
  const call = createCall({ functions: createTestFunctions() })

  // Reading a void return is what the rule guards against, and is exactly
  // what this case asserts.
  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
  const result = call('get-entry', { entryId: 'entry-1' })

  // Verify: the return value is undefined
  expect(result).toBeUndefined()

  await waitForRequest()
})
