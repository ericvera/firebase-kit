import type { Query } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { getDBSnapshot } from './getDBSnapshot.js'

const state = vi.hoisted(() => ({
  /** Queries the underlying utility was handed, in call order. */
  queried: [] as unknown[],
}))

vi.mock('firestore-snapshot-utils', () => ({
  getDBSnapshot: (queries: unknown) => {
    state.queried.push(queries)

    return Promise.resolve([])
  },
}))

const createQuery = (name: string) => ({ name }) as unknown as Query

it('passes a bare query straight through', async () => {
  state.queried = []

  const query = createQuery('entries')

  await getDBSnapshot(query)

  // Verify: a single query is wrapped into the list the utility expects, and
  // reaches it untouched
  expect(state.queried).toEqual([[query]])
})

it('resolves a refs object to its all-documents query', async () => {
  state.queried = []

  const query = createQuery('spaces')

  await getDBSnapshot({ testAllQuery: () => query })

  // Verify: the duck-type is unwrapped, so a suite can name its refs rather
  // than restating each collection's query
  expect(state.queried).toEqual([[query]])
})

it('accepts refs and bare queries mixed in one call', async () => {
  state.queried = []

  const refsQuery = createQuery('spaces')
  const bareQuery = createQuery('entries')

  await getDBSnapshot([{ testAllQuery: () => refsQuery }, bareQuery])

  // Verify: both shapes resolve in place and keep their order, which is what
  // a snapshot spanning a parent collection and a subcollection needs
  expect(state.queried).toEqual([[refsQuery, bareQuery]])
})
