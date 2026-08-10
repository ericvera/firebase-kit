import { beforeEach, expect, it } from 'vitest'
import {
  addSpaceToDB,
  spaceRefs,
  testDB,
  TestSpaceID1,
} from '../../__test__/db/index.js'
import { setFakeTimer } from '../../__test__/utils/setFakeTimer.js'
import { TransactionReader } from './TransactionReader.js'

let now = 0

beforeEach(async () => {
  now = setFakeTimer('2025-01-24T12:00')
  await addSpaceToDB(now)
})

it('get() retrieves document from transaction', async () => {
  await testDB.getFirestore().runTransaction(async (transaction) => {
    const reader = new TransactionReader(transaction)
    const docRef = spaceRefs.doc(TestSpaceID1)

    const snapshot = await reader.get(docRef)

    expect(snapshot.exists).toBe(true)
    expect(snapshot.id).toBe(TestSpaceID1)
  })
})

it('does not expose write methods', async () => {
  await testDB.getFirestore().runTransaction((transaction) => {
    const reader = new TransactionReader(transaction)

    // Verify: the read/write split is what enforces all-reads-before-any-writes
    // inside a transaction, so a writer method leaking onto the reader would
    // silently reopen the ordering bug the two classes exist to prevent
    expect(reader).not.toHaveProperty('set')
    expect(reader).not.toHaveProperty('update')
    expect(reader).not.toHaveProperty('delete')
    expect(reader).not.toHaveProperty('create')

    return Promise.resolve()
  })
})

it('getAll() retrieves multiple documents from transaction', async () => {
  await testDB.getFirestore().runTransaction(async (transaction) => {
    const reader = new TransactionReader(transaction)
    const docRef1 = spaceRefs.doc(TestSpaceID1)
    const docRef2 = spaceRefs.doc('nonexistent')

    const snapshots = await reader.getAll(docRef1, docRef2)

    // Indexed reads are optional under `noUncheckedIndexedAccess`; an absent
    // element fails the assertions below just as a wrong one would.
    const [existingSnapshot, missingSnapshot] = snapshots

    expect(snapshots).toHaveLength(2)
    expect(existingSnapshot?.exists).toBe(true)
    expect(missingSnapshot?.exists).toBe(false)
  })
})
