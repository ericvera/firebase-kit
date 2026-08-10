import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { DBSnapshotChanges } from 'firestore-snapshot-utils'
import { getDBSnapshotChanges } from 'firestore-snapshot-utils'

/**
 * Diffs two `getDBSnapshot` results into added, modified and removed documents.
 * `masks` drops per-collection fields whose values are not stable enough to
 * assert on; the type parameter lets an app key it by its own collection enum
 * so a typo in a collection name fails to compile.
 */
export const getDBChanges = <TCollection extends string = string>(
  beforeDocs: QueryDocumentSnapshot[],
  afterDocs: QueryDocumentSnapshot[],
  masks?: Partial<Record<TCollection, string[]>>,
): DBSnapshotChanges =>
  // The underlying utility keys masks by plain string; the type parameter only
  // narrows what a caller may name, so widening back here loses nothing.
  getDBSnapshotChanges(
    beforeDocs,
    afterDocs,
    masks as Record<string, string[]> | undefined,
  )
