import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { DBSnapshot, SnapshotInput } from '../../testing/getDBSnapshot.js'

/** Wraps hand-built docs as a `DBSnapshot` for tests that skip the emulator. */
export const createDBSnapshot = (
  docs: QueryDocumentSnapshot[],
  refs: SnapshotInput[] = [],
): DBSnapshot => ({ docs, refs })
