import type { DBSnapshotChanges } from 'firestore-snapshot-utils'
import { getDiffFromDBSnapshotChanges } from 'firestore-snapshot-utils'

/**
 * Renders `getDBChanges` output as the printable DB DIFF string an emulator
 * test pins with an inline snapshot. Timestamps and Buffers come out already
 * normalized (`/Timestamp 0000/`, `/Buffer .../`).
 */
export const getDBChangesDiff = (changes: DBSnapshotChanges): string =>
  getDiffFromDBSnapshotChanges(changes)
