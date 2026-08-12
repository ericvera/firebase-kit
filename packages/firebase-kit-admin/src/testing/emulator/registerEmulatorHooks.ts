import { afterAll, beforeAll, beforeEach, vi } from 'vitest'
import { checkEmulatorRunning } from './internal/checkEmulatorRunning.js'
import { createGetTestProjectId } from './internal/createGetTestProjectId.js'
import { deleteEmulatorFirestoreData } from './internal/deleteEmulatorFirestoreData.js'
import { initializeTestApp } from './internal/initializeTestApp.js'
import type { EmulatorHooksOptions } from './types.js'

/**
 * Sets up emulator-backed Admin SDK testing for one app. Called once from that
 * app's vitest setup file, and normally the only line that file needs: it
 * initializes the Firebase app and registers the three hooks that keep test
 * files from seeing each other's data.
 *
 * Everything here is the same for any app running Admin SDK tests against a
 * Firestore emulator — pointing the SDK at it, keeping concurrent workers and
 * concurrent checkouts apart, wiping between files, and failing readably when
 * nothing is listening. Only the project name, the ports and the command that
 * starts the emulator differ, so those are what an app supplies.
 */
export const registerEmulatorHooks = ({
  projectIdBase,
  isolationSeed,
  firestoreHost,
  authHost,
  onReset,
  startInstruction,
}: EmulatorHooksOptions): void => {
  const getTestProjectId = createGetTestProjectId(projectIdBase, isolationSeed)

  initializeTestApp({
    projectId: getTestProjectId(),
    firestoreHost,
    authHost,
  })

  const resetEmulator = async () => {
    await Promise.all([
      deleteEmulatorFirestoreData(getTestProjectId()),
      onReset?.(),
    ])
  }

  // The reachability check lives in beforeAll so an unreachable emulator is
  // reported once per file instead of once per test.
  beforeAll(async () => {
    await checkEmulatorRunning(startInstruction)
    await resetEmulator()
  })

  // Resetting the timers here matters as much as wiping the data: a fake timer
  // left installed by one test leaks into the next and surfaces there as an
  // unrelated date assertion.
  beforeEach(async () => {
    await deleteEmulatorFirestoreData(getTestProjectId())
    vi.useRealTimers()
  })

  // Leaves the emulator as clean as the file found it.
  afterAll(async () => {
    await resetEmulator()
  })
}
