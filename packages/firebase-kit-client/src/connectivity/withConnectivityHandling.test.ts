import { beforeEach, expect, it } from 'vitest'
import { ConnectionStatus } from './constants.js'
import type { ConnectivityHandlingDependencies } from './types.js'
import { withConnectivityHandling } from './withConnectivityHandling.js'

interface HandlingTestState {
  /** Port methods in the order the subject reached them. */
  portCalls: string[]
  /** Every code the app's predicate was asked about. */
  checkedCodes: (string | undefined)[]
  /** What the next connectivity probe resolves to. */
  probedStatus: ConnectionStatus
}

const state: HandlingTestState = {
  portCalls: [],
  checkedCodes: [],
  probedStatus: ConnectionStatus.Online,
}

// The app's policy stands in for hosting's isPotentialConnectivityErrorCode:
// one code worth probing, everything else fatal.
const ConnectivityErrorCode = 'functions/deadline-exceeded'

const createDependencies = (
  overrides: Partial<ConnectivityHandlingDependencies> = {},
): ConnectivityHandlingDependencies => ({
  isClient: true,
  connectivity: {
    markHealthy: () => {
      state.portCalls.push('markHealthy')
    },
    refreshConnectionStatus: () => {
      state.portCalls.push('refreshConnectionStatus')

      return Promise.resolve(state.probedStatus)
    },
  },
  isPotentialConnectivityErrorCode: (errorCode) => {
    state.checkedCodes.push(errorCode)

    return errorCode === ConnectivityErrorCode
  },
  ...overrides,
})

const createFailure = (code: string, message: string) =>
  Object.assign(new Error(message), { code })

beforeEach(() => {
  state.portCalls = []
  state.checkedCodes = []
  state.probedStatus = ConnectionStatus.Online
})

it('returns the value and marks the connection healthy on success', async () => {
  const result = await withConnectivityHandling(createDependencies(), () =>
    Promise.resolve({ entryId: 'entry-1' }),
  )

  // Verify: the call's value comes back untouched, and reaching the backend
  // marks the connection healthy — which is what clears a stale offline banner
  expect({ result, portCalls: state.portCalls }).toMatchInlineSnapshot(`
    {
      "portCalls": [
        "markHealthy",
      ],
      "result": {
        "entryId": "entry-1",
      },
    }
  `)
})

it('leaves client connection state alone when it is not running in the browser', async () => {
  const result = await withConnectivityHandling(
    createDependencies({ isClient: false }),
    () => Promise.resolve({ entryId: 'entry-1' }),
  )

  // Verify: a server render still gets its value, but touches no port method —
  // the healthy marker is browser-only state
  expect({ result, portCalls: state.portCalls }).toMatchInlineSnapshot(`
    {
      "portCalls": [],
      "result": {
        "entryId": "entry-1",
      },
    }
  `)
})

it('throws a connectivity error when a probed code finds the connection degraded', async () => {
  state.probedStatus = ConnectionStatus.Offline

  const failure = withConnectivityHandling(createDependencies(), () =>
    Promise.reject(createFailure(ConnectivityErrorCode, 'deadline exceeded')),
  )

  // Verify: the resolved status replaces the original error, so callers can
  // fall back to cached data instead of surfacing a Firebase code
  await expect(failure).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ConnectivityError: Connectivity issue: offline]`,
  )
  expect({ checkedCodes: state.checkedCodes, portCalls: state.portCalls })
    .toMatchInlineSnapshot(`
      {
        "checkedCodes": [
          "functions/deadline-exceeded",
        ],
        "portCalls": [
          "refreshConnectionStatus",
        ],
      }
    `)
})

it('rethrows the original error when the probe reports the connection is online', async () => {
  state.probedStatus = ConnectionStatus.Online

  const failure = withConnectivityHandling(createDependencies(), () =>
    Promise.reject(createFailure(ConnectivityErrorCode, 'deadline exceeded')),
  )

  // Verify: a probeable code whose probe comes back healthy is a real backend
  // failure, so the original error survives rather than becoming an offline one
  await expect(failure).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: deadline exceeded]`,
  )
  expect({ checkedCodes: state.checkedCodes, portCalls: state.portCalls })
    .toMatchInlineSnapshot(`
      {
        "checkedCodes": [
          "functions/deadline-exceeded",
        ],
        "portCalls": [
          "refreshConnectionStatus",
        ],
      }
    `)
})

it('passes an error the app does not count as a connectivity code straight through', async () => {
  const failure = withConnectivityHandling(createDependencies(), () =>
    Promise.reject(createFailure('functions/permission-denied', 'denied')),
  )

  // Verify: the original error is rethrown and no probe was made — an app-fatal
  // code must not cost a connectivity round trip
  await expect(failure).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: denied]`,
  )
  expect({ checkedCodes: state.checkedCodes, portCalls: state.portCalls })
    .toMatchInlineSnapshot(`
      {
        "checkedCodes": [
          "functions/permission-denied",
        ],
        "portCalls": [],
      }
    `)
})
