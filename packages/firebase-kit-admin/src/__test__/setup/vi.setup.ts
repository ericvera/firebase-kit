// Setup entry for the `emulator` vitest project only — never the `unit`
// project, whose files mock `firebase-admin/app` and would break if an app
// were initialized underneath them.
import { registerEmulatorHooks } from '../../testing/emulator/registerEmulatorHooks.js'

// Ports match this package's own `firebase.json`; under `emulators:exec` the
// CLI has already exported both, and the hooks leave those in place. The
// project base matches the `--project` that `test-emulator` starts the
// emulator under — the hooks append the per-checkout and per-worker suffixes
// on top of it.
registerEmulatorHooks({
  projectIdBase: 'demo-admin-tests',
  isolationSeed: import.meta.url,
  firestoreHost: '127.0.0.1:8281',
  authHost: '127.0.0.1:9298',
  startInstruction:
    'Run this group through `yarn test`, which starts one, or point ' +
    'FIRESTORE_EMULATOR_HOST at an emulator that is already running.',
})
