import type { FirebaseApp } from 'firebase/app'
import { Timestamp } from 'firebase/firestore'
import { Timestamp as LiteTimestamp } from 'firebase/firestore/lite'
import type { Functions } from 'firebase/functions'
import { beforeEach, expect, it, vi } from 'vitest'
import { createActionableFunctionCaller } from './createActionableFunctionCaller.js'
import type {
  ActionableFunctionCallerDependencies,
  ActionableFunctionCallerOptions,
} from './types.js'

type TestCommand = 'get-entry' | 'update-order'

interface TestMap {
  'get-entry': [
    { entryId: string; note?: string | undefined },
    { updated: unknown },
  ]
  'update-order': [{ entryId: string }, { updated: unknown }]
}

type TestCategory = 'default' | 'low-frequency'

interface CallerTestState {
  callableArguments: { name: string; options: unknown }[]
  resolvedFunctions: unknown[]
  callSequence: string[]
  rateLimitChecks: { functionName: string; category: string }[]
  responseData: unknown
  rejection: Error | undefined
  sentPayloads: unknown[]
}

const state = vi.hoisted((): CallerTestState => ({
  callableArguments: [],
  resolvedFunctions: [],
  callSequence: [],
  rateLimitChecks: [],
  responseData: {},
  rejection: undefined,
  sentPayloads: [],
}))

// The subject reaches the Functions SDK through a dynamic import inside the
// call, so this factory has to be in place before the call rather than before
// the module loads.
vi.mock('firebase/functions', () => ({
  getFunctions: (app: unknown) => ({ resolvedFrom: app }),
  httpsCallable: (functions: unknown, name: string, options: unknown) => {
    state.callableArguments.push({ name, options })
    state.resolvedFunctions.push(functions)

    return (data: unknown) => {
      state.callSequence.push('callable')
      state.sentPayloads.push(data)

      if (state.rejection !== undefined) {
        return Promise.reject(state.rejection)
      }

      return Promise.resolve({ data: state.responseData })
    }
  },
}))

const createDependencies = (
  overrides: Partial<ActionableFunctionCallerDependencies<TestCategory>> = {},
): ActionableFunctionCallerDependencies<TestCategory> => ({
  currentAPIVersion: 42,
  checkRateLimit: (functionName, category) => {
    state.rateLimitChecks.push({ functionName, category })
  },
  withConnectivityHandling: (serviceCall) => {
    state.callSequence.push('connectivity-wrapper')

    return serviceCall()
  },
  toActionableError: (error, message) =>
    Object.assign(new Error(message), { cause: error }),
  firebaseApp: undefined,
  functions: undefined,
  ...overrides,
})

// Structural stand-ins rather than real SDK instances: the subject only ever
// passes them along, so nothing here is ever called.
const hostApp: FirebaseApp = {
  name: 'host-app',
  options: {},
  automaticDataCollectionEnabled: false,
}

const hostFunctions: Functions = {
  app: hostApp,
  region: 'us-east1',
  customDomain: null,
}

const createCall = (
  name: string,
  options?: ActionableFunctionCallerOptions<TestCommand, TestCategory>,
) =>
  createActionableFunctionCaller<TestCommand, TestMap, TestCategory>(
    createDependencies(),
    name,
    'default',
    options,
  )

const createCallWithDependencies = (
  overrides: Partial<ActionableFunctionCallerDependencies<TestCategory>>,
) =>
  createActionableFunctionCaller<TestCommand, TestMap, TestCategory>(
    createDependencies(overrides),
    'fast',
    'default',
  )

beforeEach(() => {
  state.callableArguments = []
  state.resolvedFunctions = []
  state.callSequence = []
  state.rateLimitChecks = []
  state.responseData = {}
  state.rejection = undefined
  state.sentPayloads = []
})

it('sends the payload with the action and the bound API version', async () => {
  const call = createCall('fast')

  await call('get-entry', { entryId: 'entry-1' })

  // Verify: the envelope is the payload plus `action` and the bound `v`, sent
  // to the callable named at bind time with no timeout override
  expect(state.sentPayloads).toMatchInlineSnapshot(`
    [
      {
        "action": "get-entry",
        "entryId": "entry-1",
        "v": 42,
      },
    ]
  `)
  expect(state.callableArguments).toMatchInlineSnapshot(`
    [
      {
        "name": "fast",
        "options": undefined,
      },
    ]
  `)
})

it('drops undefined payload keys rather than sending them', async () => {
  const call = createCall('fast')

  await call('get-entry', { entryId: 'entry-1', note: undefined })

  // Verify: the JSON round trip removes `note` entirely — left in place, the
  // Functions SDK would deliver it to the backend as null
  expect(state.sentPayloads).toMatchInlineSnapshot(`
    [
      {
        "action": "get-entry",
        "entryId": "entry-1",
        "v": 42,
      },
    ]
  `)
})

it('applies the configured timeout when building the callable', async () => {
  const call = createCall('ai', { timeoutMs: 90000 })

  await call('get-entry', { entryId: 'entry-1' })

  // Verify: a bound timeout reaches the SDK as its `timeout` option
  expect(state.callableArguments).toMatchInlineSnapshot(`
    [
      {
        "name": "ai",
        "options": {
          "timeout": 90000,
        },
      },
    ]
  `)
})

it('builds the callable against a Functions instance made from the host app', async () => {
  const call = createCallWithDependencies({ firebaseApp: hostApp })

  await call('get-entry', { entryId: 'entry-1' })

  // Verify: with no Functions instance supplied, one is derived from the host's
  // Firebase app rather than from the SDK's default app
  expect(state.resolvedFunctions).toMatchInlineSnapshot(`
    [
      {
        "resolvedFrom": {
          "automaticDataCollectionEnabled": false,
          "name": "host-app",
          "options": {},
        },
      },
    ]
  `)
})

it('builds the callable against the Functions instance the host supplies', async () => {
  const call = createCallWithDependencies({
    firebaseApp: hostApp,
    functions: hostFunctions,
  })

  await call('get-entry', { entryId: 'entry-1' })

  // Verify: a supplied instance is used as-is — the host app is not re-resolved
  // behind its back, which would silently drop a non-default region or domain
  expect(state.resolvedFunctions).toMatchInlineSnapshot(`
    [
      {
        "app": {
          "automaticDataCollectionEnabled": false,
          "name": "host-app",
          "options": {},
        },
        "customDomain": null,
        "region": "us-east1",
      },
    ]
  `)
  expect(state.resolvedFunctions[0]).toBe(hostFunctions)
})

it('invokes the callable from inside the connectivity wrapper', async () => {
  const call = createCall('fast')

  await call('get-entry', { entryId: 'entry-1' })

  // Verify: the request goes through the injected offline wrapper rather than
  // straight to the SDK, so a dropped connection is handled before it surfaces
  expect(state.callSequence).toMatchInlineSnapshot(`
    [
      "connectivity-wrapper",
      "callable",
    ]
  `)
})

it('returns the response data with its timestamps revived', async () => {
  state.responseData = { updated: { seconds: 5, nanoseconds: 6 } }

  const call = createCall('fast')

  const result = await call('get-entry', { entryId: 'entry-1' })

  // Verify: the wire-shaped `{ seconds, nanoseconds }` a callable returns comes
  // back as a real lite-SDK Timestamp — the full SDK's class is a different
  // one, so an `instanceof` downstream depends on which was built
  expect({
    value: result,
    isLiteTimestamp: result.updated instanceof LiteTimestamp,
    isFullTimestamp: result.updated instanceof Timestamp,
  }).toMatchInlineSnapshot(`
    {
      "isFullTimestamp": false,
      "isLiteTimestamp": true,
      "value": {
        "updated": {
          "nanoseconds": 6,
          "seconds": 5,
          "type": "firestore/timestamp/1.0",
        },
      },
    }
  `)
})

it('checks the rate limit under the group and action with the default category', async () => {
  const call = createCall('fast')

  await call('get-entry', { entryId: 'entry-1' })

  // Verify: the budget key names the group and the action, so two actions of
  // one group never share a budget
  expect(state.rateLimitChecks).toMatchInlineSnapshot(`
    [
      {
        "category": "default",
        "functionName": "fast:get-entry",
      },
    ]
  `)
})

it('checks the rate limit with the per-action category when the map names one', async () => {
  const call = createCall('fast', {
    rateLimitMap: { 'update-order': 'low-frequency' },
  })

  await call('update-order', { entryId: 'entry-1' })
  await call('get-entry', { entryId: 'entry-1' })

  // Verify: a mapped action takes its own category while an unmapped one falls
  // back to the group default
  expect(state.rateLimitChecks).toMatchInlineSnapshot(`
    [
      {
        "category": "low-frequency",
        "functionName": "fast:update-order",
      },
      {
        "category": "default",
        "functionName": "fast:get-entry",
      },
    ]
  `)
})

it('wraps a failed call in the host app error naming the group and action', async () => {
  state.rejection = new Error('internal')

  const call = createCall('fast')

  const result = call('get-entry', { entryId: 'entry-1' })

  // Verify: the failure comes back through the injected error factory, with a
  // message that says which callable and action failed
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Error calling service 'fast' action 'get-entry']`,
  )
  await expect(
    result.catch((error: unknown) =>
      error instanceof Error ? error.cause : error,
    ),
  ).resolves.toMatchInlineSnapshot(`[Error: internal]`)
})
