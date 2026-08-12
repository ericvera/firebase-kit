import { Timestamp } from 'firebase-admin/firestore'
import {
  TestPersonDisplayName1,
  TestPersonHandle1,
  TestPersonID1,
  TestSchemaVersion,
} from './constants.js'
import { personRefs } from './personRefs.js'
import type { DBPerson } from './types.js'

/**
 * Seeds one `people` document. Called twice with the same `handle` and
 * different ids when a test needs a query to come back with more than one
 * result.
 */
export const addPersonToDB = async (
  now: number,
  overwrites?: Partial<DBPerson> & { id?: string },
): Promise<void> => {
  const { id = TestPersonID1, ...rest } = overwrites ?? {}

  const timestamp = Timestamp.fromMillis(now)

  await personRefs.doc(id).set({
    v: TestSchemaVersion,
    created: timestamp,
    updated: timestamp,
    handle: TestPersonHandle1,
    displayName: TestPersonDisplayName1,
    stats: {
      active: 0,
      archived: 0,
    },
    ...rest,
  })
}
