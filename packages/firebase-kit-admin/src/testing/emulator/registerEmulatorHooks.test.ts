import { expect, it, vi } from 'vitest'
import { getInitializeAppOptions } from '../../__mocks__/firebase-admin/app/index.js'
import { stubFetch } from '../../__test__/utils/stubFetch.js'
import { registerEmulatorHooks } from './registerEmulatorHooks.js'

const state = vi.hoisted((): HooksTestState => ({
  resets: 0,
}))

vi.mock('firebase-admin/app')

interface HooksTestState {
  /** How many times the app's own reset ran. */
  resets: number
}

vi.stubEnv('VITEST_POOL_ID', '')

const { requests } = stubFetch()

// Called at module scope, exactly as an app's setup file calls it, so the hooks
// it registers really run around the test below — that is what makes this a
// test of the composition rather than of three separate calls.
registerEmulatorHooks({
  projectIdBase: 'demo-tests',
  isolationSeed: 'file:///checkout/a/setup.ts',
  firestoreHost: 'emulator-host:8080',
  authHost: 'emulator-host:9099',
  startInstruction: 'Start it first.',
  onReset: () => {
    state.resets += 1

    return Promise.resolve()
  },
})

it('initializes an isolated app and wipes data around every file and test', () => {
  // Verify: the app is registered once under the isolated project id, the
  // reachability probe runs before the file, and both the file-level and the
  // per-test wipe target that same project — with the app's own reset running
  // alongside the file-level one
  expect({ ...state, initializedApps: getInitializeAppOptions(), requests })
    .toMatchInlineSnapshot(`
    {
      "initializedApps": [
        {
          "projectId": "demo-tests-5248fc25",
        },
      ],
      "requests": [
        {
          "method": undefined,
          "url": "http://emulator-host:8080",
        },
        {
          "method": "DELETE",
          "url": "http://emulator-host:8080/emulator/v1/projects/demo-tests-5248fc25/databases/(default)/documents",
        },
        {
          "method": "DELETE",
          "url": "http://emulator-host:8080/emulator/v1/projects/demo-tests-5248fc25/databases/(default)/documents",
        },
      ],
      "resets": 1,
    }
  `)
})
