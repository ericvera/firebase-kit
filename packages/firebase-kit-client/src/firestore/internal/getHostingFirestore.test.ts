import { beforeEach, expect, it, vi } from 'vitest'
import {
  initializeApp,
  resetFirebaseAppMocks,
} from '../../__mocks__/firebase/app/index.js'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import { FirestoreVariant } from '../constants.js'
import type { FirestoreUtilsDependencies } from '../types.js'
import { createGetHostingFirestore } from './getHostingFirestore.js'

const state = vi.hoisted(() => ({
  /** Which SDK entry point built the instance, and with what database id. */
  built: [] as { sdk: string; databaseId: string | undefined }[],
}))

vi.mock('firebase/app')

vi.mock('firebase/firestore', () => ({
  getFirestore: (_app: unknown, databaseId?: string) => {
    state.built.push({ sdk: 'full', databaseId })

    return { sdk: 'full' }
  },
}))

vi.mock('firebase/firestore/lite', () => ({
  getFirestore: (_app: unknown, databaseId?: string) => {
    state.built.push({ sdk: 'lite', databaseId })

    return { sdk: 'lite' }
  },
}))

beforeEach(() => {
  resetFirebaseAppMocks()
  initializeApp()
})

const createDependencies = (
  overrides: Partial<FirestoreUtilsDependencies> = {},
): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies({ ...overrides })

it('builds the lite instance against the default database', async () => {
  state.built = []

  const getHostingFirestore = createGetHostingFirestore(createDependencies())

  await getHostingFirestore(FirestoreVariant.FirestoreLite)

  // Verify: a lite read on a non-live host takes the lite SDK and passes no
  // database id, so Firestore uses the project default
  expect(state.built).toMatchInlineSnapshot(`
    [
      {
        "databaseId": undefined,
        "sdk": "lite",
      },
    ]
  `)
})

it('passes the named database id when the app asks for it', async () => {
  state.built = []

  const getHostingFirestore = createGetHostingFirestore(
    createDependencies({ databaseId: () => 'named-db' }),
  )

  await getHostingFirestore(FirestoreVariant.FirestoreLite)

  // Verify: the bound id reaches the SDK — a deployed build reads the named
  // database rather than the default one
  expect(state.built).toMatchInlineSnapshot(`
    [
      {
        "databaseId": "named-db",
        "sdk": "lite",
      },
    ]
  `)
})

it('builds the full instance for a subscribing read', async () => {
  state.built = []

  const getHostingFirestore = createGetHostingFirestore(createDependencies())

  await getHostingFirestore(FirestoreVariant.Firestore)

  // Verify: the full variant selects the full SDK, which is the only one that
  // can hold a listener open
  expect(state.built).toMatchInlineSnapshot(`
    [
      {
        "databaseId": undefined,
        "sdk": "full",
      },
    ]
  `)
})

it('forces the full SDK for a lite read when the app requires it', async () => {
  state.built = []

  const getHostingFirestore = createGetHostingFirestore(
    createDependencies({ useFullSDK: () => true }),
  )

  await getHostingFirestore(FirestoreVariant.FirestoreLite)

  // Verify: the escape hatch wins over the requested variant — the emulator
  // harness only wires up the full SDK, so a lite read has to go through it
  expect(state.built).toMatchInlineSnapshot(`
    [
      {
        "databaseId": undefined,
        "sdk": "full",
      },
    ]
  `)
})
