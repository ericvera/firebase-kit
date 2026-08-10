import type { CollectionReference, Query } from 'firebase-admin/firestore'
import { testDB } from './testDB.js'
import type { DBPerson } from './types.js'

const ref = (): CollectionReference<DBPerson, DBPerson> =>
  testDB.collectionDataPoint<DBPerson>('people')

/**
 * Ref builder for the `people` collection. `personByHandleQuery` is
 * deliberately unlimited so a test can seed two documents with the same handle
 * and exercise the multiple-results branch.
 */
export const personRefs = {
  doc: (personId: string) => ref().doc(personId),

  personByHandleQuery: (handle: string): Query<DBPerson, DBPerson> =>
    ref().where('handle', '==', handle),
}
