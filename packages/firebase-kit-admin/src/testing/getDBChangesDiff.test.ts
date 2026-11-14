import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { Timestamp } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { createDBSnapshot } from '../__test__/utils/createDBSnapshot.js'
import { createDocSnapshot } from '../__test__/utils/createDocSnapshot.js'
import type { DBMasks } from './getDBChangesDiff.js'
import { getDBChangesDiff } from './getDBChangesDiff.js'
import { getDBSnapshot } from './getDBSnapshot.js'
import { formatDBChanges } from './internal/formatDBChanges.js'
import { getDBChanges } from './internal/getDBChanges.js'

interface Space {
  name: string
  at: Timestamp
  updated: string
  meta: { at: Timestamp; keep: string } | null
  tags: string[]
}

interface Schema {
  spaces: Space
}

const createMutableQuery = (initial: QueryDocumentSnapshot[]) => {
  const state = { docs: initial }
  const query = { get: () => ({ docs: state.docs }) } as unknown as Query

  return { state, query }
}

const beforeDocs = () => [
  createDocSnapshot({
    path: 'spaces/space-1',
    data: { name: 'Old', updated: 'a' },
    updateTimeMs: 1,
  }),
  createDocSnapshot({
    path: 'spaces/space-2',
    data: { name: 'Gone' },
    updateTimeMs: 1,
  }),
]

const afterDocs = () => [
  createDocSnapshot({
    path: 'spaces/space-1',
    data: { name: 'New', updated: 'b' },
    updateTimeMs: 2,
  }),
  createDocSnapshot({
    path: 'spaces/space-3',
    data: { name: 'Added', updated: 'c' },
    updateTimeMs: 2,
  }),
]

it('returns the formatted changes since the before snapshot', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const before = await getDBSnapshot(query)
  state.docs = afterDocs()

  const diff = await getDBChangesDiff(before)

  const expected = formatDBChanges(
    getDBChanges(createDBSnapshot(beforeDocs()), createDBSnapshot(afterDocs())),
  )

  // Verify: added, modified and removed docs all render exactly as the
  // explicit snapshot/changes/diff sequence would
  expect(diff).toBe(expected)
  expect(diff).toContain('ADDED (path: spaces/[ID])')
  expect(diff).toContain('MODIFIED (path: spaces/[ID])')
  expect(diff).toContain('REMOVED (path: spaces/[ID])')
})

it('passes masks through to getDBChanges', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const before = await getDBSnapshot(query)
  state.docs = afterDocs()

  const masks: DBMasks<Schema> = { spaces: ['updated'] }
  const masked = await getDBChangesDiff<Schema>(before, masks)
  const unmasked = await getDBChangesDiff(before)

  const expected = formatDBChanges(
    getDBChanges(
      createDBSnapshot(beforeDocs()),
      createDBSnapshot(afterDocs()),
      masks,
    ),
  )

  expect(masked).toBe(expected)
  expect(masked).not.toBe(unmasked)
})

it('gives the same diff when called twice on one before snapshot', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const before = await getDBSnapshot(query)
  state.docs = afterDocs()

  const first = await getDBChangesDiff(before)
  const second = await getDBChangesDiff(before)

  // Verify: the first call's in-place sort of before.docs leaves the second
  // call's diff unchanged
  expect(second).toBe(first)
})

it('accepts a hand-built snapshot', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const taken = await getDBSnapshot(query)
  state.docs = afterDocs()

  const expected = await getDBChangesDiff(taken)
  const diff = await getDBChangesDiff(createDBSnapshot(beforeDocs(), [query]))

  // Verify: nothing ties refs to getDBSnapshot, so any { docs, refs } value
  // re-reads its refs the same way
  expect(diff).toBe(expected)
})

it('re-reads every input, refs object and bare query', async () => {
  const refs = createMutableQuery([])
  const bare = createMutableQuery([])
  const refsGet = vi.spyOn(refs.query, 'get')
  const bareGet = vi.spyOn(bare.query, 'get')

  const before = await getDBSnapshot([
    { testAllQuery: () => refs.query },
    bare.query,
  ])
  refs.state.docs = [createDocSnapshot({ path: 'spaces/space-1', data: {} })]
  bare.state.docs = [createDocSnapshot({ path: 'entries/entry-1', data: {} })]

  const diff = await getDBChangesDiff(before)

  expect(refsGet).toHaveBeenCalledTimes(2)
  expect(bareGet).toHaveBeenCalledTimes(2)
  expect(diff).toContain('ADDED (path: spaces/[ID])')
  expect(diff).toContain('ADDED (path: entries/[ID])')
})

it('keeps unmasked timestamp numbers stable when a timestamp is masked', async () => {
  const timestampedDocs = (
    atMs: number,
    updatedMs: number,
    updateTimeMs: number,
  ) => [
    createDocSnapshot({
      path: 'spaces/space-1',
      data: {
        at: Timestamp.fromMillis(atMs),
        updated: Timestamp.fromMillis(updatedMs),
      },
      updateTimeMs,
    }),
  ]
  const diffWith = async (masks?: DBMasks<Schema>) => {
    const { state, query } = createMutableQuery(timestampedDocs(1000, 5000, 1))
    const before = await getDBSnapshot(query)
    state.docs = timestampedDocs(9000, 6000, 2)

    return getDBChangesDiff<Schema>(before, masks)
  }

  const unmasked = await diffWith()
  const masked = await diffWith({ spaces: ['at'] })

  // Verify: without the mask `at` takes index 0000, with it `updated` does
  expect(unmasked).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     MODIFIED (path: spaces/[ID])
    --------------------------------
      Object {
    -   "at": "/Timestamp 0000/",
    -   "updated": "/Timestamp 0001/",
    +   "at": "/Timestamp 0003/",
    +   "updated": "/Timestamp 0002/",
      }"
  `)
  expect(masked).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     MODIFIED (path: spaces/[ID])
    --------------------------------
      Object {
    -   "at": "/Timestamp (before)/",
    -   "updated": "/Timestamp 0000/",
    +   "at": "/Timestamp (after)/",
    +   "updated": "/Timestamp 0001/",
      }"
  `)
})

it('masks a nested timestamp by dotted path', async () => {
  const metaDocs = (metaAtMs: number, updateTimeMs: number) => [
    createDocSnapshot({
      path: 'spaces/space-1',
      data: {
        at: Timestamp.fromMillis(1000),
        meta: { at: Timestamp.fromMillis(metaAtMs), keep: 'kept' },
      },
      updateTimeMs,
    }),
  ]
  const { state, query } = createMutableQuery(metaDocs(5000, 1))
  const before = await getDBSnapshot(query)
  state.docs = metaDocs(9000, 2)

  const diff = await getDBChangesDiff<Schema>(before, { spaces: ['meta.at'] })

  // Verify: the nested value takes change tokens, its sibling stays visible
  // and the unmasked timestamp numbers from 0000
  expect(diff).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     MODIFIED (path: spaces/[ID])
    --------------------------------
      Object {
        "at": "/Timestamp 0000/",
        "meta": Object {
    -     "at": "/Timestamp (before)/",
    +     "at": "/Timestamp (after)/",
          "keep": "kept",
        },
      }"
  `)
})

it('names a parent by number and lists its children under it', async () => {
  const createSpace = (name: string, updateTimeMs: number) =>
    createDocSnapshot({ path: 'spaces/space-1', data: { name }, updateTimeMs })
  const { state, query } = createMutableQuery([createSpace('Old', 1)])
  const before = await getDBSnapshot(query)
  state.docs = [
    createDocSnapshot({
      path: 'spaces/space-1/entries/entry-1',
      data: { label: 'first' },
      updateTimeMs: 2,
    }),
    createSpace('New', 2),
  ]

  const diff = await getDBChangesDiff(before)

  // Verify: the space reads `[ID 1]` in its own section and in its entry's
  // path, and its section comes first although the entry is an addition
  expect(diff).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     MODIFIED (path: spaces/[ID 1])
    --------------------------------
      Object {
    -   "name": "Old",
    +   "name": "New",
      }
    --------------------------------

    --------------------------------
     ADDED (path: spaces/[ID 1]/entries/[ID])
    --------------------------------
    + Object {
    +   "label": "first",
    + }"
  `)
})

it('type checks mask paths against the schema', async () => {
  const before = createDBSnapshot([])
  const diffs = await Promise.all([
    getDBChangesDiff<Schema>(before, { spaces: ['meta.at', 'tags', 'at'] }),
    getDBChangesDiff(before),
    // @ts-expect-error misspelled path
    getDBChangesDiff<Schema>(before, { spaces: ['updatd'] }),
    // @ts-expect-error array element path
    getDBChangesDiff<Schema>(before, { spaces: ['tags.0'] }),
    // @ts-expect-error path into a Timestamp
    getDBChangesDiff<Schema>(before, { spaces: ['meta.at.seconds'] }),
    // @ts-expect-error unknown collection
    getDBChangesDiff<Schema>(before, { entries: ['name'] }),
    // @ts-expect-error masks without a schema
    getDBChangesDiff(before, { spaces: ['updated'] }),
  ])

  expect(diffs).toHaveLength(7)
})
