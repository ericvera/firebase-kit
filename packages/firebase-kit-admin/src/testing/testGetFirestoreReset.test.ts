import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { initializeApp } from '../__mocks__/firebase-admin/app/index.js'
import { createGetFirestore } from '../firestore/internal/createGetFirestore.js'
import { testGetFirestoreReset } from './testGetFirestoreReset.js'

const state = vi.hoisted(() => ({
  databaseIds: [] as string[],
}))

vi.mock('firebase-admin/app')

// Each initialization hands back a distinct object, which is what lets the
// case below tell a fresh instance from the cached one.
vi.mock('firebase-admin/firestore', () => ({
  initializeFirestore: (
    _app: unknown,
    _settings: unknown,
    databaseId: string,
  ) => {
    state.databaseIds.push(databaseId)

    return { settings: () => undefined }
  },
}))

const options = {
  databaseId: 'named-db-id',
  emulatorDatabaseId: '(default)',
}

beforeEach(() => {
  initializeApp()

  state.databaseIds = []
})

afterEach(() => {
  vi.unstubAllEnvs()
})

it('drops a binding cache so the next call initializes again', () => {
  const getFirestore = createGetFirestore(options)

  const first = getFirestore()

  testGetFirestoreReset()

  const second = getFirestore()

  // Verify: the reset reaches a binding it never received directly — it finds
  // it through the registry — and forces a second initialization
  expect({ same: first === second, databaseIds: state.databaseIds })
    .toMatchInlineSnapshot(`
      {
        "databaseIds": [
          "named-db-id",
          "named-db-id",
        ],
        "same": false,
      }
    `)
})

it('refuses to run outside a unit-test environment', () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('FUNCTIONS_EMULATOR', undefined)

  // Verify: the hatch is guarded, so shipping a call to it cannot drop a live
  // app's instance
  expect(() => {
    testGetFirestoreReset()
  }).toThrowErrorMatchingInlineSnapshot(
    `[Error: This code is expected to only run in unit test environments.]`,
  )
})
