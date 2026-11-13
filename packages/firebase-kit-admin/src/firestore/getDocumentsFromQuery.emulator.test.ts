import { beforeEach, expect, it, vi } from 'vitest'
import {
  addPersonToDB,
  personRefs,
  testDB,
  TestPersonID1,
  TestPersonID2,
} from '../__test__/db/index.js'
import { setFakeTimer } from '../__test__/utils/setFakeTimer.js'
import { normalizeData } from '../testing/normalizeData.js'
import { getDocumentsFromQuery } from './getDocumentsFromQuery.js'

vi.hoisted(() => {
  vi.resetModules()
})

let now = 0

beforeEach(() => {
  vi.useRealTimers()
  now = setFakeTimer('2025-01-01T12:00')
})

const addTwoPeople = async (handle: string) => {
  await addPersonToDB(now, {
    id: TestPersonID1,
    handle,
    displayName: 'Person 1',
  })
  await addPersonToDB(now, {
    id: TestPersonID2,
    handle,
    displayName: 'Person 2',
  })
}

it('returns an empty array when the query matches nothing', async () => {
  const result = await getDocumentsFromQuery(
    personRefs.personByHandleQuery('nonexistent'),
  )

  expect(result).toEqual([])
})

it('returns every matching document with its id', async () => {
  await addTwoPeople('shared')

  const result = await getDocumentsFromQuery(
    personRefs.personByHandleQuery('shared'),
  )

  expect(normalizeData(result.sort((a, b) => a.id.localeCompare(b.id))))
    .toMatchInlineSnapshot(`
    [
      {
        "created": "/Timestamp 0000/",
        "displayName": "Person 1",
        "handle": "shared",
        "id": "person-id-1",
        "stats": {
          "active": 0,
          "archived": 0,
        },
        "updated": "/Timestamp 0000/",
        "v": 1,
      },
      {
        "created": "/Timestamp 0000/",
        "displayName": "Person 2",
        "handle": "shared",
        "id": "person-id-2",
        "stats": {
          "active": 0,
          "archived": 0,
        },
        "updated": "/Timestamp 0000/",
        "v": 1,
      },
    ]
  `)
})

it('returns every matching document with its id through a transaction reader', async () => {
  await addTwoPeople('sharedtx')

  const result = await testDB.runTransaction(async (reader) =>
    getDocumentsFromQuery(personRefs.personByHandleQuery('sharedtx'), reader),
  )

  expect(normalizeData(result.sort((a, b) => a.id.localeCompare(b.id))))
    .toMatchInlineSnapshot(`
    [
      {
        "created": "/Timestamp 0000/",
        "displayName": "Person 1",
        "handle": "sharedtx",
        "id": "person-id-1",
        "stats": {
          "active": 0,
          "archived": 0,
        },
        "updated": "/Timestamp 0000/",
        "v": 1,
      },
      {
        "created": "/Timestamp 0000/",
        "displayName": "Person 2",
        "handle": "sharedtx",
        "id": "person-id-2",
        "stats": {
          "active": 0,
          "archived": 0,
        },
        "updated": "/Timestamp 0000/",
        "v": 1,
      },
    ]
  `)
})
