import { expect, it, vi } from 'vitest'
import { initializeApp } from '../../__mocks__/firebase-admin/app/index.js'
import { createCollectionDataPoint } from './createCollectionDataPoint.js'
import { createGetFirestore } from './createGetFirestore.js'

vi.mock('firebase-admin/app')

vi.mock('firebase-admin/firestore', () => ({
  initializeFirestore: () => ({
    settings: () => undefined,
    collection: (name: string) => ({ path: name }),
  }),
}))

// Registered once at module scope: `getFirestore` is called lazily inside each
// case and throws unless the shared registry already holds an app.
initializeApp()

const getFirestore = createGetFirestore({
  databaseId: 'test-db-id',
  emulatorDatabaseId: '(default)',
})

const collectionDataPoint = createCollectionDataPoint<'spaces'>(getFirestore)

it('builds a root collection ref at the collection name', () => {
  const ref = collectionDataPoint('spaces')

  // Verify: the collection name is the whole path, with no parent segments
  expect(ref.path).toMatchInlineSnapshot(`"spaces"`)
})
