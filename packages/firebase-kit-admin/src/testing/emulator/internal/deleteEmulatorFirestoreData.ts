/**
 * Wipes this worker's Firestore data so each test file starts from an empty
 * database.
 *
 * Only the `(default)` database is cleared, which is why an emulator-backed
 * binding sets `emulatorDatabaseId: '(default)'` — data written to any other
 * id survives the reset and contaminates the next file.
 */
export const deleteEmulatorFirestoreData = async (
  projectId: string,
): Promise<void> => {
  const host = process.env['FIRESTORE_EMULATOR_HOST']

  await fetch(
    `http://${String(host)}/emulator/v1/projects/${projectId}/databases/(default)/documents`,
    { method: 'DELETE' },
  )
}
