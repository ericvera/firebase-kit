import type { Firestore } from 'firebase-admin/firestore'
import { TransactionReader } from './TransactionReader.js'
import { TransactionWriter } from './TransactionWriter.js'

/**
 * Binds a `getFirestore` to a transaction helper with separate reader and
 * writer wrappers.
 *
 * The returned function automatically creates both transaction wrappers and
 * passes them to the callback, eliminating boilerplate and enforcing the
 * pattern of doing all reads before any writes.
 */
export const createRunTransaction =
  (getFirestore: () => Firestore) =>
  <T>(
    callback: (
      reader: TransactionReader,
      writer: TransactionWriter,
    ) => Promise<T>,
  ): Promise<T> =>
    getFirestore().runTransaction(async (transaction) => {
      const reader = new TransactionReader(transaction)
      const writer = new TransactionWriter(transaction)

      return callback(reader, writer)
    })
