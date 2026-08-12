import { expect, it, vi } from 'vitest'
import { initializeApp } from '../../__mocks__/firebase-admin/app/index.js'
import { TransactionReader } from './TransactionReader.js'
import { TransactionWriter } from './TransactionWriter.js'
import { createGetFirestore } from './createGetFirestore.js'
import { createRunTransaction } from './createRunTransaction.js'

vi.mock('firebase-admin/app')

// Registered once at module scope: `getFirestore` is called lazily inside each
// case and throws unless the shared registry already holds an app.
initializeApp()

vi.mock('firebase-admin/firestore', () => ({
  initializeFirestore: () => ({
    settings: () => undefined,
    // Stands in for Firestore's own retry loop: hands the update function a
    // transaction and passes its resolved value straight back.
    runTransaction: (updateFunction: (transaction: unknown) => unknown) =>
      updateFunction({ name: 'test-transaction' }),
  }),
}))

it('hands the callback a reader and a writer and returns its value', async () => {
  // Built per case rather than at module scope: `getFirestore` caches the
  // instance it initializes, so a shared binding would hand a second test the
  // first one's Firestore.
  const getFirestore = createGetFirestore({
    databaseId: 'test-db-id',
    emulatorDatabaseId: '(default)',
  })

  const runTransaction = createRunTransaction(getFirestore)

  const result = await runTransaction((reader, writer) =>
    Promise.resolve({
      readerIsWrapped: reader instanceof TransactionReader,
      writerIsWrapped: writer instanceof TransactionWriter,
      value: 'transaction-result',
    }),
  )

  // Verify: reads and writes arrive through the two separate wrappers, and the
  // callback's value is what the caller gets back
  expect(result).toMatchInlineSnapshot(`
    {
      "readerIsWrapped": true,
      "value": "transaction-result",
      "writerIsWrapped": true,
    }
  `)
})
