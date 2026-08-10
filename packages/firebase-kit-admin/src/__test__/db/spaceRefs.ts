import type { CollectionReference, Query } from 'firebase-admin/firestore'
import { testDB } from './testDB.js'
import type { DBSpace } from './types.js'

const ref = (): CollectionReference<DBSpace, DBSpace> =>
  testDB.collectionDataPoint<DBSpace>('spaces')

/**
 * Ref builder for the `spaces` collection, mirroring the per-collection modules
 * a consuming app builds on `collectionDataPoint`. `allQuery` is what the
 * before/after snapshot helpers read.
 */
export const spaceRefs = {
  doc: (spaceId: string) => ref().doc(spaceId),

  allQuery: (): Query<DBSpace, DBSpace> => ref(),
}
