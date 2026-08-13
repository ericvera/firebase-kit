import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'

export interface DocSnapshotOptions {
  /** Full Firestore path, e.g. `entries/entry-1`. */
  path: string
  /** What `data()` hands back. Returned by reference, not cloned. */
  data: Record<string, unknown>
  /** Backs `updateTime`; two docs sharing a value compare as unmodified. */
  updateTimeMs?: number
}

/**
 * Builds the slice of a `QueryDocumentSnapshot` the snapshot-diffing code
 * actually reads — `ref.path`, `ref.parent.id`, `updateTime` and `data()`.
 * Lets a unit test exercise that code without an emulator behind it.
 */
export const createDocSnapshot = ({
  path,
  data,
  updateTimeMs = 0,
}: DocSnapshotOptions): QueryDocumentSnapshot => {
  const segments = path.split('/')

  return {
    ref: {
      path,
      parent: { id: segments[segments.length - 2] ?? '' },
    },
    updateTime: Timestamp.fromMillis(updateTimeMs),
    data: () => data,
  } as unknown as QueryDocumentSnapshot
}
