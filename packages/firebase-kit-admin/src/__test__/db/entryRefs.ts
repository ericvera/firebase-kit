import type { CollectionReference } from 'firebase-admin/firestore'
import { testDB } from './testDB.js'
import type { DBEntry } from './types.js'

const ref = (spaceId: string): CollectionReference<DBEntry, DBEntry> =>
  testDB.subCollectionDataPoint<DBEntry>('spaces', spaceId, 'entries')

const nestedRef = (
  spaceId: string,
  entryId: string,
): CollectionReference<DBEntry, DBEntry> =>
  testDB.nestedSubCollectionDataPoint<DBEntry>(
    'spaces',
    spaceId,
    'entries',
    entryId,
    'entries',
  )

/**
 * Ref builders for the `entries` sub-collection, one and two levels down. These
 * are the only refs in this harness built on `subCollectionDataPoint` and
 * `nestedSubCollectionDataPoint`, so they are what proves the factory hands
 * those two properties the builder each name promises. `collection` and
 * `nestedCollection` are exposed because a test asserts on their `path`.
 */
export const entryRefs = {
  collection: (spaceId: string): CollectionReference<DBEntry, DBEntry> =>
    ref(spaceId),

  doc: (spaceId: string, entryId: string) => ref(spaceId).doc(entryId),

  nestedCollection: (
    spaceId: string,
    entryId: string,
  ): CollectionReference<DBEntry, DBEntry> => nestedRef(spaceId, entryId),

  nestedDoc: (spaceId: string, entryId: string, nestedEntryId: string) =>
    nestedRef(spaceId, entryId).doc(nestedEntryId),
}
