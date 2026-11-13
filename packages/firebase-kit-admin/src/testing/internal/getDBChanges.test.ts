import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { createDBSnapshot } from '../../__test__/utils/createDBSnapshot.js'
import { createDocSnapshot } from '../../__test__/utils/createDocSnapshot.js'
import { getDBChanges } from './getDBChanges.js'

type Collection = 'entries' | 'spaces'

const createEntry = (
  id: string,
  data: Record<string, unknown>,
  updateTimeMs: number,
) => createDocSnapshot({ path: `entries/${id}`, data, updateTimeMs })

it('sorts every document into added, removed, modified or unmodified', () => {
  const stable = createEntry('stable', { name: 'stable' }, 1000)
  const changedBefore = createEntry('changed', { name: 'before' }, 1000)
  const changedAfter = createEntry('changed', { name: 'after' }, 2000)
  const goneDoc = createEntry('gone', { name: 'gone' }, 1000)
  const newDoc = createEntry('new', { name: 'new' }, 3000)

  const changes = getDBChanges(
    createDBSnapshot([stable, changedBefore, goneDoc]),
    createDBSnapshot([stable, changedAfter, newDoc]),
  )

  // Verify: presence on each side decides added vs removed, and for a document
  // on both sides it is `updateTime` — not the data — that decides modified
  expect(changes.added.map((snapshot) => snapshot.addedDoc.ref.path)).toEqual([
    'entries/new',
  ])
  expect(
    changes.modified.map((snapshot) => snapshot.afterDoc.ref.path),
  ).toEqual(['entries/changed'])
  expect(changes.removed).toHaveLength(1)
  expect(changes.unmodified).toHaveLength(1)
})

it('treats a document whose data changed but whose updateTime did not as unmodified', () => {
  const before = createEntry('entry-1', { name: 'before' }, 1000)
  const after = createEntry('entry-1', { name: 'after' }, 1000)

  const changes = getDBChanges(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
  )

  // Verify: `updateTime` is the authority — this is what lets a suite tell an
  // untouched document from one rewritten with the same content
  expect(changes.unmodified).toHaveLength(1)
  expect(changes.modified).toHaveLength(0)
})

it('reports the removed document contents', () => {
  const goneDoc = createEntry('gone', { name: 'gone' }, 1000)

  const changes = getDBChanges(
    createDBSnapshot([goneDoc]),
    createDBSnapshot([]),
  )

  expect(changes.removed.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "- Object {
    -   "name": "gone",
    - }
    + Object {}",
    ]
  `)
})

it('applies masks per collection', () => {
  const entry = createDocSnapshot({
    path: 'entries/entry-1',
    data: { secret: 'entry-secret', name: 'entry' },
    updateTimeMs: 1000,
  })
  const space = createDocSnapshot({
    path: 'spaces/space-1',
    data: { secret: 'space-secret' },
    updateTimeMs: 1000,
  })

  const changes = getDBChanges<Collection>(
    createDBSnapshot([]),
    createDBSnapshot([entry, space]),
    {
      entries: ['secret'],
    },
  )

  // Verify: the mask is keyed by the document's parent collection, so the
  // `entries` secret is replaced by its type token while the `spaces` one — not
  // named in the mask — comes through as written
  expect(changes.added.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "- Object {}
    + Object {
    +   "name": "entry",
    +   "secret": "/String/",
    + }",
      "- Object {}
    + Object {
    +   "secret": "space-secret",
    + }",
    ]
  `)
})

it('labels a masked field that changed on a modified document', () => {
  const before = createEntry('entry-1', { name: 'Draft', secret: 'a' }, 1000)
  const after = createEntry('entry-1', { name: 'Final', secret: 'b' }, 2000)

  const changes = getDBChanges<Collection>(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
    {
      entries: ['secret'],
    },
  )

  // Verify: the overwritten secret shows as a `-` / `+` pair alongside the
  // visible change, without revealing either value
  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
    -   "name": "Draft",
    -   "secret": "/String (before)/",
    +   "name": "Final",
    +   "secret": "/String (after)/",
      }",
    ]
  `)
})

it('shows a modified document whose only change is a masked field', () => {
  const before = createEntry('entry-1', { name: 'Draft', secret: 'a' }, 1000)
  const after = createEntry('entry-1', { name: 'Draft', secret: 'b' }, 2000)

  const changes = getDBChanges<Collection>(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
    {
      entries: ['secret'],
    },
  )

  // Verify: the masked change alone is enough to produce a diff body
  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
        "name": "Draft",
    -   "secret": "/String (before)/",
    +   "secret": "/String (after)/",
      }",
    ]
  `)
})

it('keeps the plain token for an unchanged masked field on a modified document', () => {
  const before = createEntry('entry-1', { name: 'Draft', secret: 'a' }, 1000)
  const after = createEntry('entry-1', { name: 'Final', secret: 'a' }, 2000)

  const changes = getDBChanges<Collection>(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
    {
      entries: ['secret'],
    },
  )

  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
    -   "name": "Draft",
    +   "name": "Final",
        "secret": "/String/",
      }",
    ]
  `)
})

it('labels a masked timestamp that was rewritten', () => {
  const before = createEntry(
    'entry-1',
    { at: Timestamp.fromMillis(1000) },
    1000,
  )
  const after = createEntry('entry-1', { at: Timestamp.fromMillis(5000) }, 2000)

  const changes = getDBChanges<Collection>(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
    {
      entries: ['at'],
    },
  )

  // Verify: there is no timestamp special case — the normalized index differs,
  // so the masked field reads as changed
  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
    -   "at": "/String (before)/",
    +   "at": "/String (after)/",
      }",
    ]
  `)
})

it('masks nothing when no masks are given', () => {
  const entry = createEntry('entry-1', { secret: 'entry-secret' }, 1000)

  const changes = getDBChanges(createDBSnapshot([]), createDBSnapshot([entry]))

  // Verify: the default the inlined body applies for an absent mask is an empty
  // object, which masks nothing rather than throwing
  expect(changes.added.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "- Object {}
    + Object {
    +   "secret": "entry-secret",
    + }",
    ]
  `)
})

it('indexes timestamps across both snapshots together', () => {
  const before = createEntry(
    'entry-1',
    { at: Timestamp.fromMillis(1000) },
    1000,
  )
  const after = createEntry('entry-1', { at: Timestamp.fromMillis(5000) }, 2000)

  const changes = getDBChanges(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
  )

  // Verify: both documents' timestamps are collected before any of them is
  // normalized, so the diff reads as "moved from the earlier instant to the
  // later one" rather than two zeroth timestamps that look equal
  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
    -   "at": "/Timestamp 0000/",
    +   "at": "/Timestamp 0001/",
      }",
    ]
  `)
})

it('sorts both snapshot arrays in place', () => {
  const later = createEntry('later', {}, 5000)
  const earlier = createEntry('earlier', {}, 1000)
  const before = createDBSnapshot([later, earlier])
  const after = createDBSnapshot([later, earlier])

  getDBChanges(before, after)

  // Verify: the ported implementation sorts its inputs rather than copying them
  // — a caller reusing the arrays afterwards sees the new order
  expect(before.docs.map((doc) => doc.ref.path)).toEqual([
    'entries/earlier',
    'entries/later',
  ])
  expect(after.docs.map((doc) => doc.ref.path)).toEqual([
    'entries/earlier',
    'entries/later',
  ])
})
