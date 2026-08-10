import { type Mock, vi } from 'vitest'
import type { FirebaseAdminFirestoreMockOptions } from './types.js'

// Every call signature below takes `...args: unknown[]`: the faked surface
// ignores its arguments entirely and a test chains it with as many or as few
// as the call it is standing in for would carry.
type OpenDocument = (...args: unknown[]) => object
type RunQuery = (...args: unknown[]) => Promise<MockQuerySnapshot>
type FilterQuery = (...args: unknown[]) => MockQuery
type LimitQuery = (...args: unknown[]) => MockQuery
type SelectFields = (...args: unknown[]) => Mock<FilterQuery>
type OpenCollection = (...args: unknown[]) => MockCollection
type ConvertCollection = (...args: unknown[]) => MockConvertedCollection

/** What the faked `get` resolves with. */
interface MockQuerySnapshot {
  doc: Mock<OpenDocument>
}

/** The chainable query surface `where` and `limit` hand back. */
interface MockQuery {
  where: Mock<FilterQuery>
  get: Mock<RunQuery>
  limit: Mock<LimitQuery>
  select: Mock<SelectFields>
}

/** What `withConverter` hands back. */
interface MockConvertedCollection {
  doc: Mock<OpenDocument>
  where: Mock<FilterQuery>
}

/** The collection surface `collection` hands back. */
interface MockCollection {
  withConverter: Mock<ConvertCollection>
}

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
  const collection = vi.fn<OpenCollection>()
  const doc = vi.fn<OpenDocument>()
  const get = vi.fn<RunQuery>()
  const limit = vi.fn<LimitQuery>()
  const select = vi.fn<SelectFields>()
  const where = vi.fn<FilterQuery>()

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
    withConverter: vi.fn<ConvertCollection>().mockReturnValue({ doc, where }),
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
