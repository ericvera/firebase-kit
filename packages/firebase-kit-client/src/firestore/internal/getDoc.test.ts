import type { DocumentReference } from 'firebase/firestore/lite'
import { expect, it, vi } from 'vitest'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import type { FirestoreUtilsDependencies } from '../types.js'
import { createGetDoc } from './getDoc.js'

const state = vi.hoisted(() => ({
  /** What the SDK read returns for the next call. */
  document: undefined as Record<string, unknown> | undefined,
  /** How many times the connectivity wrapper was entered. */
  wrapped: 0,
}))

vi.mock('firebase/firestore/lite', () => ({
  getDoc: () => Promise.resolve({ data: () => state.document }),
}))

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies({
    withConnectivityHandling: (serviceCall) => {
      state.wrapped += 1

      return serviceCall()
    },
  })

const getRef = () => Promise.resolve({} as DocumentReference)

it('returns the document with its id folded in', async () => {
  state.document = { name: 'A space', open: true }
  state.wrapped = 0

  const getDoc = createGetDoc(createDependencies())

  const result = await getDoc({ id: 'space-1', getRef })

  // Verify: the id the caller asked for is added to the data, and the read went
  // through the connectivity wrapper so an offline failure is actionable
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "A space",
      "open": true,
    }
  `)
  expect(state.wrapped).toEqual(1)
})

it('returns undefined when the document does not exist', async () => {
  state.document = undefined
  state.wrapped = 0

  const getDoc = createGetDoc(createDependencies())

  const result = await getDoc({ id: 'missing', getRef })

  // Verify: a missing document is absence, not an object holding only an id
  expect(result).toBeUndefined()
})
