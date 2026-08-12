import { Timestamp } from 'firebase-admin/firestore'
import {
  TestSchemaVersion,
  TestSpaceHandle1,
  TestSpaceID1,
  TestSpaceName1,
} from './constants.js'
import { spaceRefs } from './spaceRefs.js'
import type { DBSpace } from './types.js'

/**
 * Seeds one `spaces` document so a test has something real to read back. `now`
 * stamps both timestamps, so a test that pins a clock gets a stable document.
 */
export const addSpaceToDB = async (
  now: number,
  overwrites?: Partial<DBSpace> & { id?: string },
): Promise<void> => {
  const { id = TestSpaceID1, ...rest } = overwrites ?? {}

  const timestamp = Timestamp.fromMillis(now)

  await spaceRefs.doc(id).set({
    v: TestSchemaVersion,
    created: timestamp,
    updated: timestamp,
    name: TestSpaceName1,
    handle: TestSpaceHandle1,
    ...rest,
  })
}
