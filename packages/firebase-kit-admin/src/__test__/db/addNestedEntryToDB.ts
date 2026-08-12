import { Timestamp } from 'firebase-admin/firestore'
import {
  TestEntryID1,
  TestNestedEntryID1,
  TestNestedEntryLabel1,
  TestSchemaVersion,
  TestSpaceID1,
} from './constants.js'
import { entryRefs } from './entryRefs.js'
import type { DBEntry } from './types.js'

/**
 * Seeds one document two levels down (`entries` under an entry), so a test has
 * a real two-levels-nested document to read back through the ref builder the
 * factory bound to `nestedSubCollectionDataPoint`.
 */
export const addNestedEntryToDB = async (
  now: number,
  overwrites?: Partial<DBEntry> & {
    spaceId?: string
    entryId?: string
    id?: string
  },
): Promise<void> => {
  const {
    spaceId = TestSpaceID1,
    entryId = TestEntryID1,
    id = TestNestedEntryID1,
    ...rest
  } = overwrites ?? {}

  const timestamp = Timestamp.fromMillis(now)

  await entryRefs.nestedDoc(spaceId, entryId, id).set({
    v: TestSchemaVersion,
    created: timestamp,
    updated: timestamp,
    label: TestNestedEntryLabel1,
    ...rest,
  })
}
