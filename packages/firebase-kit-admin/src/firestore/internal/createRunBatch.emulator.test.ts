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

it('allows writing within batch', async () => {
  await addSpaceToDB(now)

  const beforeSnapshot = await getDBSnapshot(refs)

  await testDB.runBatch((batch) => {
    const docRef = spaceRefs.doc(TestSpaceID1)

    batch.update(docRef, {
      name: 'Updated Name',
      updated: FieldValue.serverTimestamp(),
    })
  })

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

it('commits all batch operations atomically', async () => {
  await addSpaceToDB(now)

  const beforeSnapshot = await getDBSnapshot(refs)

  await testDB.runBatch((batch) => {
    const docRef = spaceRefs.doc(TestSpaceID1)

    batch.update(docRef, {
      name: 'First Update',
      updated: FieldValue.serverTimestamp(),
    })

    batch.update(docRef, {
      name: 'Second Update',
      updated: FieldValue.serverTimestamp(),
    })
  })

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
    +   "name": "Second Update",
    +   "updated": "/Timestamp 0001/",
        "v": 1,
      }"
  `)
})
