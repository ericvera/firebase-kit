const ExitErrorCode = 1

/**
 * Exits the worker with a readable instruction when the emulator is
 * unreachable, rather than letting every test in the group fail as an opaque
 * Firestore timeout.
 *
 * `startInstruction` is the app's own start command, so this package never has
 * to know how any one app starts an emulator.
 */
export const checkEmulatorRunning = async (
  startInstruction: string,
): Promise<void> => {
  const host = process.env['FIRESTORE_EMULATOR_HOST']

  try {
    const result = await fetch(`http://${String(host)}`)

    if (result.status === 200) {
      return
    }
  } catch {
    // Falls through to the message below — an unreachable host and a non-200
    // response are the same problem from a test's point of view.
  }

  console.error(
    `No Firestore emulator is reachable at ${String(host)}. ${startInstruction}`,
  )

  process.exit(ExitErrorCode)
}
