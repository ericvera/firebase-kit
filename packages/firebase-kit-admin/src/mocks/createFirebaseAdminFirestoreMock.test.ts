import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { createFirebaseAdminFirestoreMock } from './createFirebaseAdminFirestoreMock.js'

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

  const collection = mock.getFirestore().collection('entries')
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
