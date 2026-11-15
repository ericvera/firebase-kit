import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { createDBSnapshot } from '../../__test__/utils/createDBSnapshot.js'
import { createDocSnapshot } from '../../__test__/utils/createDocSnapshot.js'
import { getDBChanges } from './getDBChanges.js'

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

  const changes = getDBChanges(
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

  const changes = getDBChanges(
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

  const changes = getDBChanges(
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

  const changes = getDBChanges(
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

  const changes = getDBChanges(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
    {
      entries: ['at'],
    },
  )

  // Verify: there is no timestamp special case — the instants differ, so the
  // masked field reads as changed
  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
    -   "at": "/Timestamp (before)/",
    +   "at": "/Timestamp (after)/",
      }",
    ]
  `)
})

it('prints the Timestamp token for a masked Timestamp', () => {
  const unchangedBefore = createEntry(
    'unchanged',
    { at: Timestamp.fromMillis(1000), name: 'Draft' },
    1000,
  )
  const unchangedAfter = createEntry(
    'unchanged',
    { at: Timestamp.fromMillis(1000), name: 'Final' },
    2000,
  )
  const changedBefore = createEntry(
    'changed',
    { at: Timestamp.fromMillis(1000) },
    1000,
  )
  const changedAfter = createEntry(
    'changed',
    { at: Timestamp.fromMillis(5000) },
    2000,
  )
  const added = createEntry('added', { at: Timestamp.fromMillis(1000) }, 3000)

  const changes = getDBChanges(
    createDBSnapshot([unchangedBefore, changedBefore]),
    createDBSnapshot([unchangedAfter, changedAfter, added]),
    {
      entries: ['at'],
    },
  )

  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
        "at": "/Timestamp/",
    -   "name": "Draft",
    +   "name": "Final",
      }",
      "  Object {
    -   "at": "/Timestamp (before)/",
    +   "at": "/Timestamp (after)/",
      }",
    ]
  `)
  expect(changes.added.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "- Object {}
    + Object {
    +   "at": "/Timestamp/",
    + }",
    ]
  `)
})

it('leaves masked timestamps out of the numbering', () => {
  const before = createEntry(
    'entry-1',
    { at: Timestamp.fromMillis(1000), updated: Timestamp.fromMillis(5000) },
    1000,
  )
  const after = createEntry(
    'entry-1',
    { at: Timestamp.fromMillis(9000), updated: Timestamp.fromMillis(6000) },
    2000,
  )

  const changes = getDBChanges(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
    {
      entries: ['at'],
    },
  )

  // Verify: the masked `at` takes no index, so `updated` numbers from zero
  expect(changes.modified.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "  Object {
    -   "at": "/Timestamp (before)/",
    -   "updated": "/Timestamp 0000/",
    +   "at": "/Timestamp (after)/",
    +   "updated": "/Timestamp 0001/",
      }",
    ]
  `)
})

it('leaves a Timestamp inside a masked map out of the numbering', () => {
  const entry = createEntry(
    'entry-1',
    {
      meta: { at: Timestamp.fromMillis(1000) },
      updated: Timestamp.fromMillis(5000),
    },
    1000,
  )

  const changes = getDBChanges(
    createDBSnapshot([]),
    createDBSnapshot([entry]),
    {
      entries: ['meta'],
    },
  )

  expect(changes.added.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "- Object {}
    + Object {
    +   "meta": "/Map/",
    +   "updated": "/Timestamp 0000/",
    + }",
    ]
  `)
})

it('leaves a nested masked Timestamp out of the numbering', () => {
  const entry = createEntry(
    'entry-1',
    {
      meta: {
        at: Timestamp.fromMillis(1000),
        seen: Timestamp.fromMillis(3000),
      },
      updated: Timestamp.fromMillis(5000),
    },
    1000,
  )

  const changes = getDBChanges(
    createDBSnapshot([]),
    createDBSnapshot([entry]),
    {
      entries: ['meta.at'],
    },
  )

  // Verify: only the masked leaf becomes a token, and its sibling and the
  // top-level Timestamp number from zero
  expect(changes.added.map((snapshot) => snapshot.getDiff()))
    .toMatchInlineSnapshot(`
    [
      "- Object {}
    + Object {
    +   "meta": Object {
    +     "at": "/Timestamp/",
    +     "seen": "/Timestamp 0000/",
    +   },
    +   "updated": "/Timestamp 0001/",
    + }",
    ]
  `)
})

it("does not modify the documents' nested data", () => {
  const at = Timestamp.fromMillis(1000)
  const meta = { at, keep: 'x' }
  const data = { meta }
  const entry = createEntry('entry-1', data, 1000)

  getDBChanges(createDBSnapshot([]), createDBSnapshot([entry]), {
    entries: ['meta.at'],
  })

  // Verify: masking copies the maps along the path rather than writing into
  // the caller's nested object
  expect(data.meta).toBe(meta)
  expect(data.meta.at).toBe(at)
})

it("does not modify the documents' data", () => {
  const at = Timestamp.fromMillis(1000)
  const data = { at, name: 'entry' }
  const entry = createEntry('entry-1', data, 1000)

  getDBChanges(createDBSnapshot([]), createDBSnapshot([entry]), {
    entries: ['at'],
  })

  // Verify: masking runs on a copy, because `data()` hands back the caller's
  // object
  expect(data.at).toBe(at)
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

const createSpace = (
  id: string,
  data: Record<string, unknown>,
  updateTimeMs: number,
) => createDocSnapshot({ path: `spaces/${id}`, data, updateTimeMs })

const createSpaceEntry = (
  spaceId: string,
  id: string,
  data: Record<string, unknown>,
  updateTimeMs: number,
) =>
  createDocSnapshot({
    path: `spaces/${spaceId}/entries/${id}`,
    data,
    updateTimeMs,
  })

it('numbers the parent in the path of a subcollection document', () => {
  const ana = createSpace('zzz', { name: 'Ana' }, 1000)
  const luis = createSpace('aaa', { name: 'Luis' }, 1000)
  const entry = createSpaceEntry('aaa', 'entry-1', { label: 'new' }, 2000)

  const changes = getDBChanges(
    createDBSnapshot([ana, luis]),
    createDBSnapshot([ana, luis, entry]),
  )

  // Verify: the space is named by its rank among the spaces, which comes from
  // their content, so the path holds nothing that differs between runs. The
  // ids alone would rank these two the other way round
  expect(changes.added.map((snapshot) => snapshot.normalizedPath)).toEqual([
    'spaces/[ID 2]/entries/[ID]',
  ])
})

it('keeps the path of a child when the test rewrites its parent', () => {
  const ana = createSpace('space-a', { name: 'Ana' }, 1000)
  const luis = createSpace('space-b', { name: 'Luis' }, 1000)
  const anaRenamed = createSpace('space-a', { name: 'Zoe' }, 2000)
  const entry = createSpaceEntry('space-a', 'entry-1', { label: 'new' }, 2000)

  const changes = getDBChanges(
    createDBSnapshot([ana, luis]),
    createDBSnapshot([anaRenamed, luis, entry]),
  )

  // Verify: the space is ranked by what it held before the test, so renaming
  // it to sort after its sibling does not turn its child's `[ID 1]` into
  // `[ID 2]`
  expect(changes.added.map((snapshot) => snapshot.normalizedPath)).toEqual([
    'spaces/[ID 1]/entries/[ID]',
  ])
})

it('names a parent the same for its added and its removed children', () => {
  const before = createSpace('space-a', { name: 'Ana', count: 1 }, 1000)
  const after = createSpace('space-a', { name: 'Ana', count: 2 }, 2000)
  const gone = createSpaceEntry('space-a', 'entry-1', { label: 'old' }, 1000)
  const added = createSpaceEntry('space-a', 'entry-2', { label: 'new' }, 2000)

  const changes = getDBChanges(
    createDBSnapshot([before, gone]),
    createDBSnapshot([after, added]),
  )

  // Verify: the parent changed during the test, and both children still point
  // at the same parent, which its own section names the same way
  expect(changes.removed.map((snapshot) => snapshot.normalizedPath)).toEqual([
    'spaces/[ID 1]/entries/[ID]',
  ])
  expect(changes.added.map((snapshot) => snapshot.normalizedPath)).toEqual([
    'spaces/[ID 1]/entries/[ID]',
  ])
  expect(changes.modified.map((snapshot) => snapshot.normalizedPath)).toEqual([
    'spaces/[ID 1]',
  ])
})

it('leaves masked fields out of the parent numbering', () => {
  const diffWith = (anaKey: string, luisKey: string) => {
    const ana = createSpace('space-a', { key: anaKey, name: 'Ana' }, 1000)
    const luis = createSpace('space-b', { key: luisKey, name: 'Luis' }, 1000)
    const entry = createSpaceEntry('space-b', 'entry-1', { label: 'new' }, 2000)

    return getDBChanges(
      createDBSnapshot([ana, luis]),
      createDBSnapshot([ana, luis, entry]),
      { spaces: ['key'] },
    ).added.map((snapshot) => snapshot.normalizedPath)
  }

  // Verify: `key` sorts ahead of `name`, so unmasked it would decide the rank
  // and two runs with different random keys would number the spaces
  // differently
  expect(diffWith('zzz', 'aaa')).toEqual(['spaces/[ID 2]/entries/[ID]'])
  expect(diffWith('aaa', 'zzz')).toEqual(['spaces/[ID 2]/entries/[ID]'])
})

it('does not number a collection whose documents have no changed children', () => {
  const ana = createSpace('space-a', { name: 'Ana' }, 1000)
  const luisBefore = createSpace('space-b', { name: 'Luis' }, 1000)
  const luisAfter = createSpace('space-b', { name: 'Luis M.' }, 2000)
  const entry = createSpaceEntry('space-a', 'entry-1', { label: 'old' }, 1000)

  const changes = getDBChanges(
    createDBSnapshot([ana, luisBefore, entry]),
    createDBSnapshot([ana, luisAfter, entry]),
  )

  // Verify: the only subcollection document is unchanged, so the diff has no
  // child section to match the space against and it keeps the bare `[ID]`
  expect(changes.modified.map((snapshot) => snapshot.normalizedPath)).toEqual([
    'spaces/[ID]',
  ])
})

it('throws when the parent of a subcollection document is not in the snapshot', () => {
  const entry = createSpaceEntry('space-a', 'entry-1', { label: 'new' }, 2000)

  // Verify: the parent has to be part of the snapshot, otherwise it cannot be
  // numbered among its siblings
  expect(() =>
    getDBChanges(createDBSnapshot([]), createDBSnapshot([entry])),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Document not found for path: spaces/space-a (an ancestor of spaces/space-a/entries/entry-1). Add a ref or query covering the spaces collection to getDBSnapshot, so the ancestor is in the snapshot.]`,
  )
})
