import { Timestamp } from 'firebase-admin/firestore'
import {
  TestEntryID1,
  TestEntryLabel1,
  TestSchemaVersion,
  TestSpaceID1,
} from './constants.js'
import { entryRefs } from './entryRefs.js'
import type { DBEntry } from './types.js'

/**
 * Seeds one document in the `entries` sub-collection of a space, so a test has
 * a real one-level-nested document to read back through the ref builder the
 * factory bound to `subCollectionDataPoint`.
 */
export const addEntryToDB = async (
  now: number,
  overwrites?: Partial<DBEntry> & { spaceId?: string; id?: string },
): Promise<void> => {
  const {
    spaceId = TestSpaceID1,
    id = TestEntryID1,
    ...rest
  } = overwrites ?? {}

  const timestamp = Timestamp.fromMillis(now)

  await entryRefs.doc(spaceId, id).set({
    v: TestSchemaVersion,
    created: timestamp,
    updated: timestamp,
    label: TestEntryLabel1,
    ...rest,
  })
}
