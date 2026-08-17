import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { createDocSnapshot } from '../__test__/utils/createDocSnapshot.js'
import { getDBSnapshot } from './getDBSnapshot.js'

const createQuery = (paths: string[]): Query =>
  ({
    get: () => ({
      docs: paths.map((path) => createDocSnapshot({ path, data: {} })),
    }),
  }) as unknown as Query

const getPaths = (docs: QueryDocumentSnapshot[]) =>
  docs.map((doc) => doc.ref.path)

it('reads a bare query', async () => {
  const docs = await getDBSnapshot(createQuery(['entries/entry-1']))

  // Verify: a single input is read without the caller wrapping it in an array
  expect(getPaths(docs)).toEqual(['entries/entry-1'])
})

it('resolves a refs object to its all-documents query', async () => {
  const query = createQuery(['spaces/space-1'])

  const docs = await getDBSnapshot({ testAllQuery: () => query })

  // Verify: the duck-type is unwrapped, so a suite can name its refs rather
  // than restating each collection's query
  expect(getPaths(docs)).toEqual(['spaces/space-1'])
})

it('flattens refs and bare queries mixed in one call, in order', async () => {
  const refsQuery = createQuery(['spaces/space-1', 'spaces/space-2'])
  const bareQuery = createQuery(['entries/entry-1'])

  const docs = await getDBSnapshot([
    { testAllQuery: () => refsQuery },
    bareQuery,
  ])

  // Verify: both shapes resolve in place and every query's documents land in
  // one flat list, which is what a snapshot spanning several collections needs
  expect(getPaths(docs)).toEqual([
    'spaces/space-1',
    'spaces/space-2',
    'entries/entry-1',
  ])
})

it('reads every query it is given', async () => {
  const first = createQuery(['entries/entry-1'])
  const second = createQuery(['entries/entry-2'])
  const firstGet = vi.spyOn(first, 'get')
  const secondGet = vi.spyOn(second, 'get')

  await getDBSnapshot([first, second])

  expect(firstGet).toHaveBeenCalledTimes(1)
  expect(secondGet).toHaveBeenCalledTimes(1)
})

it('returns an empty list for an empty input array', async () => {
  expect(await getDBSnapshot([])).toEqual([])
})
