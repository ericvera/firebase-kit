import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { createDBSnapshot } from '../__test__/utils/createDBSnapshot.js'
import { createDocSnapshot } from '../__test__/utils/createDocSnapshot.js'
import { getDBChangesDiff } from './getDBChangesDiff.js'
import { getDBSnapshot } from './getDBSnapshot.js'
import { formatDBChanges } from './internal/formatDBChanges.js'
import { getDBChanges } from './internal/getDBChanges.js'

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

  const masks = { spaces: ['updated'] }
  const diff = await getDBChangesDiff(before, masks)

  const expected = formatDBChanges(
    getDBChanges(
      createDBSnapshot(beforeDocs()),
      createDBSnapshot(afterDocs()),
      masks,
    ),
  )

  expect(diff).toBe(expected)
  expect(diff).not.toBe(await getDBChangesDiff(before))
})

it('gives the same diff when called twice on one before snapshot', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const before = await getDBSnapshot(query)
  state.docs = afterDocs()

  const first = await getDBChangesDiff(before)

  // Verify: the first call's in-place sort of before.docs leaves the second
  // call's diff unchanged
  expect(await getDBChangesDiff(before)).toBe(first)
})

it('accepts a hand-built snapshot', async () => {
  const { state, query } = createMutableQuery(beforeDocs())
  const taken = await getDBSnapshot(query)
  state.docs = afterDocs()

  const expected = await getDBChangesDiff(taken)

  // Verify: nothing ties refs to getDBSnapshot, so any { docs, refs } value
  // re-reads its refs the same way
  expect(await getDBChangesDiff(createDBSnapshot(beforeDocs(), [query]))).toBe(
    expected,
  )
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
