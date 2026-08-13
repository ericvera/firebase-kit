import { expect, it } from 'vitest'
import { createDocSnapshot } from '../../__test__/utils/createDocSnapshot.js'
import {
  AddedDocumentSnapshot,
  ModifiedDocumentSnapshot,
  RemovedDocumentSnapshot,
  UnmodifiedDocumentSnapshot,
} from './DocumentChangeSnapshot.js'

const createEntry = (id: string, data: Record<string, unknown>) =>
  createDocSnapshot({ path: `entries/${id}`, data })

it('renders an added document as an addition against nothing', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new AddedDocumentSnapshot(doc, { name: 'first', count: 2 }, [
    doc,
  ])

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

  const snapshot = new AddedDocumentSnapshot(doc, { name: 'first' }, [doc])

  expect(snapshot.addedDoc).toBe(doc)
})

it('renders a removed document as a deletion of everything it held', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new RemovedDocumentSnapshot(
    doc,
    { name: 'first', count: 2 },
    [doc],
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
    [afterDoc],
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
    [afterDoc],
  )

  // Verify: a masked field changing under the mask leaves nothing visible, and
  // "no visual difference" is reported as no diff at all
  expect(snapshot.getDiff()).toBeUndefined()
})

it('returns no diff for an unmodified document', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new UnmodifiedDocumentSnapshot(doc, [doc])

  expect(snapshot.getDiff()).toBeUndefined()
})

it('replaces the document id in the normalized path', () => {
  const doc = createEntry('entry-1', { name: 'first' })

  const snapshot = new UnmodifiedDocumentSnapshot(doc, [doc])

  // Verify: the generated id is dropped, so a snapshot survives a rerun that
  // assigns different ids
  expect(snapshot.normalizedPath).toEqual('entries/[ID]')
})

it('replaces a subcollection parent id with a hash of the parent document', () => {
  const parentDoc = createDocSnapshot({
    path: 'spaces/space-1',
    data: { name: 'space one' },
  })
  const childDoc = createDocSnapshot({
    path: 'spaces/space-1/entries/entry-1',
    data: { name: 'first' },
  })

  const snapshot = new UnmodifiedDocumentSnapshot(childDoc, [
    parentDoc,
    childDoc,
  ])

  // Verify: the parent id is replaced by a value derived from the parent's
  // content, so two runs that write the same parent produce the same path
  expect(snapshot.normalizedPath).toMatchInlineSnapshot(
    `"spaces/asbh2OkU2iqwHWY9iJGtlwaa/entries/[ID]"`,
  )
})

it('throws when a subcollection parent is missing from the snapshot', () => {
  const childDoc = createDocSnapshot({
    path: 'spaces/space-1/entries/entry-1',
    data: { name: 'first' },
  })

  // Verify: the parent has to be part of the same snapshot, otherwise its id
  // cannot be normalized
  expect(
    () => new UnmodifiedDocumentSnapshot(childDoc, [childDoc]),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Document not found for path: spaces/space-1]`,
  )
})

it('throws on a path nested deeper than one subcollection', () => {
  const doc = createDocSnapshot({
    path: 'spaces/space-1/entries/entry-1/comments/comment-1',
    data: { text: 'hi' },
  })

  expect(
    () => new UnmodifiedDocumentSnapshot(doc, [doc]),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Path segments longer than 4 not supported yet.]`,
  )
})
