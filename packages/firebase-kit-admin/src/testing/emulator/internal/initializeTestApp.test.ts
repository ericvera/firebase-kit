import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getInitializeAppOptions,
  resetFirebaseAdminAppMocks,
} from '../../../__mocks__/firebase-admin/app/index.js'
import { initializeTestApp } from './initializeTestApp.js'

vi.mock('firebase-admin/app')

const Options = {
  projectId: 'demo-tests-5248fc25',
  firestoreHost: 'emulator-host:8080',
  authHost: 'emulator-host:9099',
}

// `initializeTestApp` writes straight to process.env rather than through
// `vi.stubEnv`, so unstubbing cannot undo it — the values are saved and put
// back by hand.
const EmulatorEnvKeys = [
  'FIRESTORE_EMULATOR_HOST',
  'FIREBASE_AUTH_EMULATOR_HOST',
  'GOOGLE_CLOUD_PROJECT',
] as const

let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  savedEnv = Object.fromEntries(
    EmulatorEnvKeys.map((key) => [key, process.env[key]]),
  )

  // Reflect rather than `delete`: assigning undefined would leave the literal
  // string "undefined", which the `??=` under test would then keep.
  for (const key of EmulatorEnvKeys) {
    Reflect.deleteProperty(process.env, key)
  }

  resetFirebaseAdminAppMocks()
})

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      Reflect.deleteProperty(process.env, key)
    } else {
      process.env[key] = value
    }
  }
})

it('points the SDK at the bound hosts when nothing has set them', () => {
  initializeTestApp(Options)

  // Verify: an app run without a wrapper still reaches its own emulator, and
  // the project is exported so the GCloud SDK skips the metadata server
  expect({
    firestore: process.env['FIRESTORE_EMULATOR_HOST'],
    auth: process.env['FIREBASE_AUTH_EMULATOR_HOST'],
    project: process.env['GOOGLE_CLOUD_PROJECT'],
  }).toMatchInlineSnapshot(`
    {
      "auth": "emulator-host:9099",
      "firestore": "emulator-host:8080",
      "project": "demo-tests-5248fc25",
    }
  `)
})

it('leaves hosts a runner already exported in place', () => {
  process.env['FIRESTORE_EMULATOR_HOST'] = '127.0.0.1:9999'
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9998'

  initializeTestApp(Options)

  // Verify: `firebase emulators:exec` picks its own ports and exports them —
  // overwriting would send the suite at an emulator that is not running
  expect(process.env['FIRESTORE_EMULATOR_HOST']).toEqual('127.0.0.1:9999')
  expect(process.env['FIREBASE_AUTH_EMULATOR_HOST']).toEqual('127.0.0.1:9998')
})

it('initializes the app only once', () => {
  initializeTestApp(Options)
  initializeTestApp(Options)

  // Verify: a second setup pass must not register a second app, which the
  // Admin SDK would reject
  expect(getInitializeAppOptions()).toMatchInlineSnapshot(`
    [
      {
        "projectId": "demo-tests-5248fc25",
      },
    ]
  `)
})
