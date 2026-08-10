import { vi } from 'vitest'
import type { FirebaseAdminFirestoreMockOptions } from './types.js'

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase-admin/firestore` module, so a bare
 * `vi.mock('firebase-admin/firestore')` hands tests a chainable query surface
 * that never reaches Firestore. Returns the faked `getFirestore` /
 * `initializeFirestore`, the real `FieldPath` and `Timestamp`, and a reset
 * helper.
 */
export const createFirebaseAdminFirestoreMock = ({
  actual,
  databaseId,
}: FirebaseAdminFirestoreMockOptions) => {
  // Create the core firestore mock functions
  const collection = vi.fn()
  const doc = vi.fn()
  const get = vi.fn()
  const limit = vi.fn()
  const select = vi.fn()
  const where = vi.fn()

  // Configure return values
  doc.mockReturnValue({})

  select.mockReturnValue(where)

  get.mockResolvedValue({
    doc,
  })

  where.mockReturnValue({
    where,
    get,
    limit,
    select,
  })

  limit.mockReturnValue({
    where,
    get,
    limit,
    select,
  })

  collection.mockReturnValue({
    withConverter: vi.fn().mockReturnValue({ doc, where }),
  })

  // Create the Firestore instance
  const firestore = {
    databaseId,
    doc,
    collection,
    settings: vi.fn(),
    collectionGroup: vi.fn(),
    getAll: vi.fn(),
    recursiveDelete: vi.fn(),
    terminate: vi.fn(),
    listCollections: vi.fn(),
    runTransaction: vi.fn(),
    batch: vi.fn(),
    bulkWriter: vi.fn(),
    bundle: vi.fn(),
  }

  const getFirestore = vi.fn(() => firestore)
  const initializeFirestore = vi.fn(() => firestore)

  // Function to reset internal state if needed for test isolation
  const resetFirestoreMock = () => {
    // Reset function call histories
    vi.mocked(getFirestore).mockClear()
    vi.mocked(initializeFirestore).mockClear()
    doc.mockClear()
    collection.mockClear()
    get.mockClear()
    limit.mockClear()
    select.mockClear()
    where.mockClear()

    // Reset basic implementations
    doc.mockReturnValue({})
    select.mockReturnValue(where)
    get.mockResolvedValue({ doc })
  }

  return {
    // Keep the actual implementations for these constants
    FieldPath: actual.FieldPath,
    Timestamp: actual.Timestamp,
    getFirestore,
    initializeFirestore,
    resetFirestoreMock,
  }
}
