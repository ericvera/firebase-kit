import { expect, it } from 'vitest'
import { createDocSnapshot } from '../../__test__/utils/createDocSnapshot.js'
import {
  AddedDocumentSnapshot,
  ModifiedDocumentSnapshot,
  RemovedDocumentSnapshot,
  UnmodifiedDocumentSnapshot,
} from './DocumentChangeSnapshot.js'
import type { DocPathSegment } from './getDocPathSegments.js'

const createEntry = (id: string, data: Record<string, unknown>) =>
  createDocSnapshot({ path: `entries/${id}`, data })

const EntryPath: DocPathSegment[] = [
  { collection: 'entries', number: undefined },
]

it('renders an added document as an addition against nothing', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new AddedDocumentSnapshot(
    doc,
    { name: 'first', count: 2 },
    EntryPath,
  )

  // Verify: the whole normalized document shows up as added, which is what the
  // printable diff strips its first line from
  expect(snapshot.getDiff()).toMatchInlineSnapshot(`
    "- Object {}
    + Object {
    +   "count": 2,
    +   "name": "first",
    + }"
  `)
})

it('exposes the document it was built from', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new AddedDocumentSnapshot(doc, { name: 'first' }, EntryPath)

  expect(snapshot.addedDoc).toBe(doc)
})

it('renders a removed document as a deletion of everything it held', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new RemovedDocumentSnapshot(
    doc,
    { name: 'first', count: 2 },
    EntryPath,
  )

  expect(snapshot.getDiff()).toMatchInlineSnapshot(`
    "- Object {
    -   "count": 2,
    -   "name": "first",
    - }
    + Object {}"
  `)
})

it('renders only the changed properties of a modified document', () => {
  const beforeDoc = createEntry('entry-1', { name: 'first' })
  const afterDoc = createEntry('entry-1', { name: 'second' })

  const snapshot = new ModifiedDocumentSnapshot(
    beforeDoc,
    afterDoc,
    { name: 'first', count: 2 },
    { name: 'second', count: 2 },
    EntryPath,
  )

  // Verify: unchanged properties are elided, so the diff stays readable on a
  // document with many stable fields
  expect(snapshot.getDiff()).toMatchInlineSnapshot(`
    "  Object {
        "count": 2,
    -   "name": "first",
    +   "name": "second",
      }"
  `)
  expect(snapshot.beforeDoc).toBe(beforeDoc)
  expect(snapshot.afterDoc).toBe(afterDoc)
})

it('returns no diff for a modified document whose normalized data matches', () => {
  const beforeDoc = createEntry('entry-1', { name: 'first' })
  const afterDoc = createEntry('entry-1', { name: 'first' })

  const snapshot = new ModifiedDocumentSnapshot(
    beforeDoc,
    afterDoc,
    { name: 'first' },
    { name: 'first' },
    EntryPath,
  )

  // Verify: equal data yields "no visual difference", which is reported as no
  // diff at all
  expect(snapshot.getDiff()).toBeUndefined()
})

it('returns no diff for an unmodified document', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new UnmodifiedDocumentSnapshot(doc, EntryPath)

  expect(snapshot.getDiff()).toBeUndefined()
})

it('prints the path segments it was given', () => {
  const doc = createDocSnapshot({
    path: 'spaces/space-1/entries/entry-1',
    data: { name: 'first' },
  })
  const pathSegments: DocPathSegment[] = [
    { collection: 'spaces', number: 1 },
    { collection: 'entries', number: undefined },
  ]

  const snapshot = new UnmodifiedDocumentSnapshot(doc, pathSegments)

  // Verify: the generated ids are gone, so a snapshot survives a rerun that
  // assigns different ones, and the segments stay available for sorting
  expect(snapshot.normalizedPath).toBe('spaces/[ID 1]/entries/[ID]')
  expect(snapshot.pathSegments).toBe(pathSegments)
})
