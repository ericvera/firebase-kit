import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { createFirebaseAdminFirestoreMock } from './createFirebaseAdminFirestoreMock.js'

/** The chainable query surface `where` and `limit` hand back. */
interface MockQuery {
  where: () => MockQuery
  limit: () => MockQuery
  get: () => Promise<unknown>
}

/** What `withConverter` hands back. */
interface MockConvertedCollection {
  where: () => MockQuery
}

/** The collection surface `collection` hands back. */
interface MockCollection {
  withConverter: () => MockConvertedCollection
}

/** The instance the faked module entry points hand back. */
interface MockFirestore {
  collection: (collectionPath: string) => MockCollection
}

const createMock = () =>
  createFirebaseAdminFirestoreMock({
    actual: { FieldPath, Timestamp },
    databaseId: 'test-db',
  })

it('reports the database id it was bound to', () => {
  const mock = createMock()

  // Verify: a bind asserting it opened the named database has something to read
  expect(mock.getFirestore().databaseId).toEqual('test-db')
})

it('hands back the real FieldPath and Timestamp', () => {
  const mock = createMock()

  // Verify: only the query surface is faked — tests build real Timestamps, and
  // a faked one would not compare against documents
  expect(mock.Timestamp).toBe(Timestamp)
  expect(mock.FieldPath).toBe(FieldPath)
})

it('returns one shared instance from both entry points', () => {
  const mock = createMock()

  // Verify: initializeFirestore and getFirestore agree, so a bind that calls
  // either sees the same faked instance
  expect(mock.initializeFirestore()).toBe(mock.getFirestore())
})

it('chains where and limit off a converted collection', async () => {
  const mock = createMock()

  // The factory's spies are deliberately untyped `vi.fn()`s, which makes
  // everything reached through them `any`. The chain is named here instead, so
  // the published mock keeps its types.
  const firestore: MockFirestore = mock.getFirestore()

  const collection = firestore.collection('entries')
  const query = collection.withConverter().where().limit().where()

  // Verify: the query builder is chainable in the shapes a ref module uses,
  // terminates in a get() that resolves
  await expect(query.get()).resolves.toBeDefined()
})

it('clears recorded calls on reset', () => {
  const mock = createMock()

  mock.getFirestore()
  mock.getFirestore()

  mock.resetFirestoreMock()

  // Verify: call history is per-test state, so one test's reads do not show up
  // in the next one's assertions
  expect(mock.getFirestore).toHaveBeenCalledTimes(0)
})
