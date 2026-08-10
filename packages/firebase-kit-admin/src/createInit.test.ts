import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getCertifiedConfigs,
  getInitializeAppOptions,
  resetFirebaseAdminAppMocks,
} from './__mocks__/firebase-admin/app/index.js'
import { createInit } from './createInit.js'

vi.mock('firebase-admin/app')

const createOptions = (inEmulator: () => boolean) => ({
  emulatorAuthHost: 'emulator-host:9099',
  emulatorFirestoreHost: 'emulator-host:8080',
  emulatorProjectId: 'demo-test-project',
  emulatorStorageBucket: 'demo-test-project.appspot.com',
  emulatorStorageHost: 'emulator-host:9199',
  inEmulator,
  storageBucket: 'test-app.firebasestorage.app',
})

const getEmulatorHosts = () => ({
  auth: process.env['FIREBASE_AUTH_EMULATOR_HOST'],
  firestore: process.env['FIRESTORE_EMULATOR_HOST'],
  storage: process.env['FIREBASE_STORAGE_EMULATOR_HOST'],
})

beforeEach(() => {
  resetFirebaseAdminAppMocks()

  // Stubbed rather than deleted so `vi.unstubAllEnvs` puts back whatever the
  // process had, including the values the subject assigns during a test.
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined)
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', undefined)
  vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

it('initializes with the bound emulator project and hosts when no credential is given', () => {
  const init = createInit(createOptions(() => true))

  init()

  // Verify: the emulator branch names the emulator project and bucket, and
  // fills in all three emulator hosts the process had not set
  expect(getInitializeAppOptions()).toMatchInlineSnapshot(`
    [
      {
        "projectId": "demo-test-project",
        "storageBucket": "demo-test-project.appspot.com",
      },
    ]
  `)
  expect(getEmulatorHosts()).toMatchInlineSnapshot(`
    {
      "auth": "emulator-host:9099",
      "firestore": "emulator-host:8080",
      "storage": "emulator-host:9199",
    }
  `)
})

it('keeps emulator hosts the process already set', () => {
  vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', 'preset-host:19099')
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', 'preset-host:18080')
  vi.stubEnv('FIREBASE_STORAGE_EMULATOR_HOST', 'preset-host:19199')

  const init = createInit(createOptions(() => true))

  init()

  // Verify: the defaults are applied with `??=`, so a harness that already
  // pointed the process at its own emulator keeps its ports
  expect(getEmulatorHosts()).toMatchInlineSnapshot(`
    {
      "auth": "preset-host:19099",
      "firestore": "preset-host:18080",
      "storage": "preset-host:19199",
    }
  `)
})

it('initializes with the credential and the production bucket when a service account is given', () => {
  const init = createInit(createOptions(() => true))

  init({ projectId: 'deployed-project' })

  // Verify: a supplied credential wins over the emulator branch — the bound
  // production bucket is used and no emulator host is set. The credential
  // itself is opaque, so which service account was certified is read off the
  // mock rather than out of the options.
  expect(
    getInitializeAppOptions().map((options) => ({
      ...options,
      credential: '<credential>',
    })),
  ).toMatchInlineSnapshot(`
    [
      {
        "credential": "<credential>",
        "storageBucket": "test-app.firebasestorage.app",
      },
    ]
  `)
  expect(getCertifiedConfigs()).toMatchInlineSnapshot(`
    [
      {
        "projectId": "deployed-project",
      },
    ]
  `)
  expect(getEmulatorHosts()).toMatchInlineSnapshot(`
    {
      "auth": undefined,
      "firestore": undefined,
      "storage": undefined,
    }
  `)
})

it('initializes with no options outside the emulator and without a credential', () => {
  const init = createInit(createOptions(() => false))

  init()

  // Verify: the deployed-default path hands the SDK nothing, so it resolves
  // the ambient project itself
  expect(getInitializeAppOptions()).toMatchInlineSnapshot(`
    [
      undefined,
    ]
  `)
})

it('does nothing when an app already exists', () => {
  const init = createInit(createOptions(() => true))

  init()
  init({ projectId: 'deployed-project' })

  // Verify: only the first call initializes, so a second cold-start hook or a
  // harness that initialized first is left alone
  expect(getInitializeAppOptions()).toMatchInlineSnapshot(`
    [
      {
        "projectId": "demo-test-project",
        "storageBucket": "demo-test-project.appspot.com",
      },
    ]
  `)
})
