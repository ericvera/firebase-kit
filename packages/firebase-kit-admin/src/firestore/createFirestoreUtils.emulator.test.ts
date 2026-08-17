import { beforeEach, expect, it } from 'vitest'
import {
  addEntryToDB,
  addNestedEntryToDB,
  entryRefs,
  TestEntryID1,
  TestNestedEntryID1,
  TestSpaceID1,
} from '../__test__/db/index.js'
import { setFakeTimer } from '../__test__/utils/setFakeTimer.js'
import { normalizeData } from '../testing/normalizeData.js'

let now = 0

beforeEach(() => {
  now = setFakeTimer('2025-01-01T12:00')
})

it('binds subCollectionDataPoint one level under the parent collection', async () => {
  await addEntryToDB(now, { label: 'Sub-collection Entry' })

  const collectionRef = entryRefs.collection(TestSpaceID1)

  // Verify: the property the factory names `subCollectionDataPoint` builds
  // `<collection>/<id>/<sub-collection>` and nothing deeper
  expect(collectionRef.path).toMatchInlineSnapshot(
    `"spaces/space-id-1/entries"`,
  )

  const snapshot = await entryRefs.doc(TestSpaceID1, TestEntryID1).get()

  // Verify: the document written through that ref reads back from the same
  // path, timestamps and all, so the builder round-trips against the emulator
  expect(normalizeData(snapshot.data())).toMatchInlineSnapshot(`
    {
      "created": "/Timestamp 0000/",
      "label": "Sub-collection Entry",
      "updated": "/Timestamp 0000/",
      "v": 1,
    }
  `)
})

it('binds nestedSubCollectionDataPoint two levels under the parent collection', async () => {
  await addNestedEntryToDB(now, { label: 'Nested Entry' })

  const collectionRef = entryRefs.nestedCollection(TestSpaceID1, TestEntryID1)

  // Verify: the property the factory names `nestedSubCollectionDataPoint`
  // builds the full four-segment path down to the nested sub-collection
  expect(collectionRef.path).toMatchInlineSnapshot(
    `"spaces/space-id-1/entries/entry-id-1/entries"`,
  )

  const snapshot = await entryRefs
    .nestedDoc(TestSpaceID1, TestEntryID1, TestNestedEntryID1)
    .get()

  // Verify: the nested document reads back from the same path, so this builder
  // is wired to the two-level binder rather than the one-level one
  expect(normalizeData(snapshot.data())).toMatchInlineSnapshot(`
    {
      "created": "/Timestamp 0000/",
      "label": "Nested Entry",
      "updated": "/Timestamp 0000/",
      "v": 1,
    }
  `)
})
