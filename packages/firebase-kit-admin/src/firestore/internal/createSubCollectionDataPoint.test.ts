import { expect, it, vi } from 'vitest'
import { initializeApp } from '../../__mocks__/firebase-admin/app/index.js'
import { createGetFirestore } from './createGetFirestore.js'
import { createSubCollectionDataPoint } from './createSubCollectionDataPoint.js'

vi.mock('firebase-admin/app')

vi.mock('firebase-admin/firestore', () => {
  // Minimal mock for the ref chain: every hop appends to `path` so the
  // assembled path is what the assertion reads back.
  const collectionAt = (path: string) => ({
    path,
    doc: (id: string) => ({
      collection: (subCollection: string) =>
        collectionAt(`${path}/${id}/${subCollection}`),
    }),
  })

  return {
    initializeFirestore: () => ({
      settings: () => undefined,
      collection: (name: string) => collectionAt(name),
    }),
  }
})

// Registered once at module scope: `getFirestore` is called lazily inside each
// case and throws unless the shared registry already holds an app.
initializeApp()

const getFirestore = createGetFirestore({
  databaseId: 'test-db-id',
  emulatorDatabaseId: '(default)',
})

const subCollectionDataPoint = createSubCollectionDataPoint<'spaces', 'people'>(
  getFirestore,
)

it('builds the sub-collection path', () => {
  const ref = subCollectionDataPoint('spaces', 'space-id', 'people')

  // Verify: the parent id sits between its collection and the sub-collection,
  // in the order the arguments are given
  expect(ref.path).toMatchInlineSnapshot(`"spaces/space-id/people"`)
})
