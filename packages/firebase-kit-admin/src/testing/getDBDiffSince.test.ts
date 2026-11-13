import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { createDocSnapshot } from '../__test__/utils/createDocSnapshot.js'
import { getDBChanges } from './getDBChanges.js'
import { getDBChangesDiff } from './getDBChangesDiff.js'
import { getDBDiffSince } from './getDBDiffSince.js'
import { getDBSnapshot } from './getDBSnapshot.js'

const MissingRefsError =
  'getDBDiffSince needs the array getDBSnapshot returned; a copy made with slice, spread or filter does not carry the refs it was taken from'

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

it('returns the same diff as the three-step form', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const before = await getDBSnapshot(query)
  state.docs = afterDocs()

  const diff = await getDBDiffSince(before)

  const expected = getDBChangesDiff(getDBChanges(beforeDocs(), afterDocs()))

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

  const masks = { spaces: ['updated'] }
  const diff = await getDBDiffSince(before, masks)

  const expected = getDBChangesDiff(
    getDBChanges(beforeDocs(), afterDocs(), masks),
  )

  expect(diff).toBe(expected)
  expect(diff).not.toBe(await getDBDiffSince(before))
})

it('can be called twice on the same before snapshot', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const before = await getDBSnapshot(query)
  state.docs = afterDocs()

  const first = await getDBDiffSince(before)

  // Verify: the in-place sort keeps the array's identity, so its refs record
  // survives the first call
  expect(await getDBDiffSince(before)).toBe(first)
})

it.each([
  ['a spread copy', (docs: QueryDocumentSnapshot[]) => [...docs]],
  ['a slice copy', (docs: QueryDocumentSnapshot[]) => docs.slice()],
  ['a hand-built array', () => beforeDocs()],
])('throws for %s', async (_label, copy) => {
  const { query } = createMutableQuery(beforeDocs())
  const before = await getDBSnapshot(query)

  await expect(getDBDiffSince(copy(before))).rejects.toThrow(MissingRefsError)
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

  const diff = await getDBDiffSince(before)

  expect(refsGet).toHaveBeenCalledTimes(2)
  expect(bareGet).toHaveBeenCalledTimes(2)
  expect(diff).toContain('ADDED (path: spaces/[ID])')
  expect(diff).toContain('ADDED (path: entries/[ID])')
})
