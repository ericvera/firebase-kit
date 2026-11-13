import { beforeEach, expect, it, vi } from 'vitest'
import {
  addSpaceToDB,
  spaceRefs,
  testDB,
  TestNonExistentID1,
  TestSpaceID1,
} from '../__test__/db/index.js'
import { setFakeTimer } from '../__test__/utils/setFakeTimer.js'
import { normalizeData } from '../testing/normalizeData.js'
import { getDocuments } from './getDocuments.js'

vi.hoisted(() => {
  vi.resetModules()
})

let now = 0

beforeEach(() => {
  vi.useRealTimers()
  now = setFakeTimer('2025-01-01T12:00')
})

it('returns the entity for an existing ref and undefined for a missing one, in ref order', async () => {
  await addSpaceToDB(now)

  const result = await getDocuments([
    spaceRefs.doc(TestSpaceID1),
    spaceRefs.doc(TestNonExistentID1),
  ])

  expect(normalizeData(result)).toMatchInlineSnapshot(`
    [
      {
        "created": "/Timestamp 0000/",
        "handle": "test-space-1",
        "id": "space-id-1",
        "name": "Test Space",
        "updated": "/Timestamp 0000/",
        "v": 1,
      },
      undefined,
    ]
  `)
})

it('follows the order of refs when they are passed reversed', async () => {
  await addSpaceToDB(now)

  const result = await getDocuments([
    spaceRefs.doc(TestNonExistentID1),
    spaceRefs.doc(TestSpaceID1),
  ])

  expect(result[0]).toBeUndefined()
  expect(result[1]?.id).toBe(TestSpaceID1)
})

it('returns an empty array for empty refs', async () => {
  const result = await getDocuments([])

  expect(result).toEqual([])
})

it('returns the entity and undefined in ref order through a transaction reader', async () => {
  await addSpaceToDB(now)

  const result = await testDB.runTransaction(async (reader) =>
    getDocuments(
      [spaceRefs.doc(TestSpaceID1), spaceRefs.doc(TestNonExistentID1)],
      reader,
    ),
  )

  expect(normalizeData(result)).toMatchInlineSnapshot(`
    [
      {
        "created": "/Timestamp 0000/",
        "handle": "test-space-1",
        "id": "space-id-1",
        "name": "Test Space",
        "updated": "/Timestamp 0000/",
        "v": 1,
      },
      undefined,
    ]
  `)
})
