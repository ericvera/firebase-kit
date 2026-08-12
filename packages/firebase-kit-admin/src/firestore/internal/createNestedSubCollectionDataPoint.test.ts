import { expect, it, vi } from 'vitest'
import { initializeApp } from '../../__mocks__/firebase-admin/app/index.js'
import { createGetFirestore } from './createGetFirestore.js'
import { createNestedSubCollectionDataPoint } from './createNestedSubCollectionDataPoint.js'

vi.mock('firebase-admin/app')

// Registered once at module scope: `getFirestore` is called lazily inside each
// case and throws unless the shared registry already holds an app.
initializeApp()

vi.mock('firebase-admin/firestore', () => {
  // Minimal stand-in for the ref chain: every hop appends to `path` so the
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

const getFirestore = createGetFirestore({
  databaseId: 'test-db-id',
  emulatorDatabaseId: '(default)',
})

const nestedSubCollectionDataPoint = createNestedSubCollectionDataPoint<
  'spaces',
  'people' | 'entries'
>(getFirestore)

it('builds the nested collection path', () => {
  const ref = nestedSubCollectionDataPoint(
    'spaces',
    'space-id',
    'people',
    'person-id',
    'entries',
  )

  // Verify: both parent ids are interleaved with their collections, in the
  // order the arguments are given
  expect(ref.path).toMatchInlineSnapshot(
    `"spaces/space-id/people/person-id/entries"`,
  )
})
