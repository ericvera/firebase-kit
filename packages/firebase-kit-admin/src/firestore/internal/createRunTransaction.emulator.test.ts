import { FieldValue } from 'firebase-admin/firestore'
import { beforeEach, expect, it } from 'vitest'
import {
  addSpaceToDB,
  spaceRefs,
  testDB,
  TestSpaceID1,
} from '../../__test__/db/index.js'
import { setFakeTimer } from '../../__test__/utils/setFakeTimer.js'
import {
  getDBChanges,
  getDBChangesDiff,
  getDBSnapshot,
} from '../../testing/index.js'

const refs = [spaceRefs.allQuery()]

let now = 0

beforeEach(() => {
  now = setFakeTimer('2025-01-01T12:00')
})

it('allows reading and writing within transaction', async () => {
  await addSpaceToDB(now)

  const beforeSnapshot = await getDBSnapshot(refs)

  await testDB.runTransaction(async (reader, writer) => {
    const docRef = spaceRefs.doc(TestSpaceID1)

    const snapshot = await reader.get(docRef)
    expect(snapshot.exists).toBe(true)

    writer.update(docRef, {
      name: 'Updated Name',
      updated: FieldValue.serverTimestamp(),
    })
  })

  // Ensure that the name was updated
  const afterSnapshot = await getDBSnapshot(refs)
  const changes = getDBChanges(beforeSnapshot, afterSnapshot)
  const diff = getDBChangesDiff(changes)
  expect(diff).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     MODIFIED (path: spaces/[ID])
    --------------------------------
      Object {
        "created": "/Timestamp 0000/",
        "handle": "test-space-1",
    -   "name": "Test Space",
    -   "updated": "/Timestamp 0000/",
    +   "name": "Updated Name",
    +   "updated": "/Timestamp 0001/",
        "v": 1,
      }"
  `)
})
