import { expect, it } from 'vitest'
import { testDB } from '../../__test__/db/index.js'
import { TransactionWriter } from './TransactionWriter.js'

it('exposes write methods', async () => {
  await testDB.getFirestore().runTransaction((transaction) => {
    const writer = new TransactionWriter(transaction)

    expect(writer).toBeInstanceOf(TransactionWriter)
    expect(typeof writer.set).toBe('function')
    expect(typeof writer.update).toBe('function')
    expect(typeof writer.delete).toBe('function')
    expect(typeof writer.create).toBe('function')

    return Promise.resolve()
  })
})

it('does not expose read methods', async () => {
  await testDB.getFirestore().runTransaction((transaction) => {
    const writer = new TransactionWriter(transaction)

    expect(writer).not.toHaveProperty('get')
    expect(writer).not.toHaveProperty('getAll')

    return Promise.resolve()
  })
})
