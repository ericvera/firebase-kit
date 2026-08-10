import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stubFetch } from '../../../__test__/utils/stubFetch.js'
import { deleteEmulatorFirestoreData } from './deleteEmulatorFirestoreData.js'

let requests: ReturnType<typeof stubFetch>['requests'] = []

beforeEach(() => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', 'emulator-host:8080')

  requests = stubFetch().requests
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('wipes the default database for this project', async () => {
  await deleteEmulatorFirestoreData('demo-tests-5248fc25')

  // Verify: the reset targets `(default)` specifically, which is why an
  // emulator-backed binding sets `emulatorDatabaseId: '(default)'`
  expect(requests).toMatchInlineSnapshot(`
    [
      {
        "method": "DELETE",
        "url": "http://emulator-host:8080/emulator/v1/projects/demo-tests-5248fc25/databases/(default)/documents",
      },
    ]
  `)
})
