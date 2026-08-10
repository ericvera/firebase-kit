import type { Query } from 'firebase/firestore/lite'
import { expect, it, vi } from 'vitest'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import type { FirestoreUtilsDependencies } from '../types.js'
import { createGetDocsWithCursor } from './getDocsWithCursor.js'

const state = vi.hoisted(() => ({
  /** Documents the SDK returns for the next query. */
  docs: [] as { id: string; data: Record<string, unknown> }[],
}))

vi.mock('firebase/firestore/lite', () => ({
  getDocs: () =>
    Promise.resolve({
      docs: state.docs.map((doc) => ({ id: doc.id, data: () => doc.data })),
    }),
}))

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies()

const getQuery = () => Promise.resolve({} as Query)

it('returns the documents alongside the last snapshot as the cursor', async () => {
  state.docs = [
    { id: 'entry-1', data: { body: 'first' } },
    { id: 'entry-2', data: { body: 'second' } },
  ]

  const getDocsWithCursor = createGetDocsWithCursor(createDependencies())

  const result = await getDocsWithCursor({ getQuery })

  // Verify: the documents come back id-folded like getDocs, and the cursor is
  // the *last* snapshot — paging from any other one would skip or repeat rows
  expect(result.documents).toMatchInlineSnapshot(`
    [
      {
        "body": "first",
        "id": "entry-1",
      },
      {
        "body": "second",
        "id": "entry-2",
      },
    ]
  `)
  expect(result.lastDocumentSnapshot?.id).toEqual('entry-2')
})

it('reports no cursor when the page is empty', async () => {
  state.docs = []

  const getDocsWithCursor = createGetDocsWithCursor(createDependencies())

  const result = await getDocsWithCursor({ getQuery })

  // Verify: an empty page yields no cursor, so the caller stops paging rather
  // than re-requesting from an undefined position
  expect(result.documents).toMatchInlineSnapshot(`[]`)
  expect(result.lastDocumentSnapshot).toBeUndefined()
})
