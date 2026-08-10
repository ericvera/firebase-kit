import type { Query } from 'firebase/firestore/lite'
import { expect, it, vi } from 'vitest'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import type { FirestoreUtilsDependencies } from '../types.js'
import { createGetDocs } from './getDocs.js'

const state = vi.hoisted(() => ({
  /** Documents the SDK returns for the next query. */
  docs: [] as { id: string; data: Record<string, unknown> }[],
  /** How many times the connectivity wrapper was entered. */
  wrapped: 0,
}))

vi.mock('firebase/firestore/lite', () => ({
  getDocs: () =>
    Promise.resolve({
      docs: state.docs.map((doc) => ({ id: doc.id, data: () => doc.data })),
    }),
}))

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies({
    withConnectivityHandling: (serviceCall) => {
      state.wrapped += 1

      return serviceCall()
    },
  })

const getQuery = () => Promise.resolve({} as Query)

it('returns every document with its id folded in', async () => {
  state.docs = [
    { id: 'entry-1', data: { total: 1200 } },
    { id: 'entry-2', data: { total: 850 } },
  ]
  state.wrapped = 0

  const getDocs = createGetDocs(createDependencies())

  const result = await getDocs({ getQuery })

  // Verify: query order is preserved and each document carries its own id, and
  // the read went through the connectivity wrapper
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "id": "entry-1",
        "total": 1200,
      },
      {
        "id": "entry-2",
        "total": 850,
      },
    ]
  `)
  expect(state.wrapped).toEqual(1)
})

it('returns an empty list when the query matches nothing', async () => {
  state.docs = []

  const getDocs = createGetDocs(createDependencies())

  // Verify: no matches is an empty array, so a caller can map over it without
  // a guard
  expect(await getDocs({ getQuery })).toMatchInlineSnapshot(`[]`)
})
