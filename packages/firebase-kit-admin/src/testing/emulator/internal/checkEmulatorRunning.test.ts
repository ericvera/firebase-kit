import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stubFetch } from '../../../__test__/utils/stubFetch.js'
import { checkEmulatorRunning } from './checkEmulatorRunning.js'

const StartInstruction = 'Start it first.'

let setStatus: ReturnType<typeof stubFetch>['setStatus']

beforeEach(() => {
  vi.stubEnv('FIRESTORE_EMULATOR_HOST', 'emulator-host:8080')

  setStatus = stubFetch().setStatus
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

it('returns quietly when the emulator answers', async () => {
  // Verify: a reachable emulator is the ordinary case and exits nothing
  await expect(checkEmulatorRunning(StartInstruction)).resolves.toBeUndefined()
})

it('exits with the app instruction when nothing is listening', async () => {
  setStatus(undefined)

  const errors: unknown[] = []

  vi.stubGlobal('console', {
    error: (message: unknown) => errors.push(message),
  })

  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never)

  await checkEmulatorRunning(StartInstruction)

  // Verify: the app's own start command is what the developer is told, so the
  // package never has to know how any one app starts an emulator
  expect(errors).toMatchInlineSnapshot(`
    [
      "No Firestore emulator is reachable at emulator-host:8080. Start it first.",
    ]
  `)
  expect(exit).toHaveBeenCalledWith(1)

  exit.mockRestore()
})

it('exits when the emulator answers with a non-200', async () => {
  setStatus(503)

  vi.stubGlobal('console', { error: () => undefined })

  const exit = vi
    .spyOn(process, 'exit')
    .mockImplementation(() => undefined as never)

  await checkEmulatorRunning(StartInstruction)

  // Verify: an unreachable host and a refusing one are the same problem from a
  // test's point of view
  expect(exit).toHaveBeenCalledWith(1)

  exit.mockRestore()
})
