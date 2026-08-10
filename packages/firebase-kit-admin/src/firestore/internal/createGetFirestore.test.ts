import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  initializeApp,
  resetFirebaseAdminAppMocks,
} from '../../__mocks__/firebase-admin/app/index.js'
import { createGetFirestore } from './createGetFirestore.js'

const state = vi.hoisted(() => ({
  databaseIds: [] as string[],
}))

vi.mock('firebase-admin/app')

// Left hand-written rather than pointed at `createFirebaseAdminFirestoreMock`:
// that factory hands back one fixed Firestore object, which would make the
// caching and reset cases below pass no matter what `getFirestore` did.
vi.mock('firebase-admin/firestore', () => ({
  // Records the database id each initialization asked for, which is the only
  // observable difference between the emulator and production branches.
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
  resetFirebaseAdminAppMocks()
  initializeApp()

  state.databaseIds = []
})

afterEach(() => {
  vi.unstubAllEnvs()
})

it('throws when no Firebase app has been initialized', () => {
  resetFirebaseAdminAppMocks()

  const getFirestore = createGetFirestore(options)

  // Verify: the failure is loud rather than a lazily-broken instance
  expect(() => getFirestore()).toThrowErrorMatchingInlineSnapshot(
    `[Error: app unexpectedly undefined when accessing Firestore init]`,
  )
})

it('initializes the named database when the emulator host is not set', () => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', undefined)

  const getFirestore = createGetFirestore(options)

  getFirestore()

  // Verify: production branch uses the configured named database
  expect(state.databaseIds).toMatchInlineSnapshot(`
    [
      "named-db-id",
    ]
  `)
})

it('initializes the default database when the emulator host is set', () => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', 'localhost:8080')

  const getFirestore = createGetFirestore(options)

  getFirestore()

  // Verify: the env read happens per call, so a stub set after bind still
  // flips the branch to the emulator database
  expect(state.databaseIds).toMatchInlineSnapshot(`
    [
      "(default)",
    ]
  `)
})

it('returns the cached instance on later calls', () => {
  const getFirestore = createGetFirestore(options)

  const first = getFirestore()
  const second = getFirestore()

  // Verify: one initialization per factory instance, same object handed back
  expect({ same: first === second, databaseIds: state.databaseIds })
    .toMatchInlineSnapshot(`
      {
        "databaseIds": [
          "named-db-id",
        ],
        "same": true,
      }
    `)
})
