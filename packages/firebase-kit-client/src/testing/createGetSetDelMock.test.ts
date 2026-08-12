import * as actual from 'getsetdel'
import { expect, it } from 'vitest'
import { createGetSetDelMock } from './createGetSetDelMock.js'

// A distinct store per case, since the in-memory IndexedDB outlives them.
let storeCount = 0

const createStoreFor = (mock: ReturnType<typeof createGetSetDelMock>) => {
  storeCount += 1

  return mock.createStore({ name: `probe-${String(storeCount)}`, version: 1 })
}

it('reads back what was written while no fault is armed', async () => {
  const mock = createGetSetDelMock(actual)

  const store = await createStoreFor(mock)

  await mock.setMany(store, [['a', { total: 1 }]])

  // Verify: the default path is the real store on the in-memory IndexedDB, so
  // a suite asserts on what was stored rather than on a recorded call
  expect(await mock.entries(store)).toMatchInlineSnapshot(`
    [
      [
        "a",
        {
          "total": 1,
        },
      ],
    ]
  `)
})

it('rejects reads with the armed error', async () => {
  const mock = createGetSetDelMock(actual)

  mock.failEntriesWith(new Error('store reset'))

  const store = await createStoreFor(mock)

  // Verify: the reset a real store only raises when another tab wipes it is
  // reachable, which is the one thing a suite cannot provoke from outside
  await expect(mock.entries(store)).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: store reset]`,
  )
})

it('reads the real store again once the fault is cleared', async () => {
  const mock = createGetSetDelMock(actual)

  mock.failEntriesWith(new Error('store reset'))
  mock.clearEntriesFault()

  const store = await createStoreFor(mock)

  await mock.setMany(store, [['a', { total: 1 }]])

  // Verify: the fault is only about the read failing — clearing it puts the
  // real store straight back, which is what a recovering retry expects
  expect(await mock.entries(store)).toMatchInlineSnapshot(`
    [
      [
        "a",
        {
          "total": 1,
        },
      ],
    ]
  `)
})

it('takes the store out of play while stubbed', async () => {
  const mock = createGetSetDelMock(actual)

  mock.stubStore()

  const store = await createStoreFor(mock)

  await mock.setMany(store, [['a', { total: 1 }]])

  // Verify: nothing reaches IndexedDB — the retry-loop cases reopen the store
  // on every attempt under fake timers, which would stall a real one
  expect(await mock.entries(store)).toMatchInlineSnapshot(`[]`)
})

it('puts the real store back on reset', async () => {
  const mock = createGetSetDelMock(actual)

  mock.stubStore()
  mock.resetGetSetDelMock()

  const store = await createStoreFor(mock)

  await mock.setMany(store, [['a', { total: 2 }]])

  // Verify: the latch is per-case, so the next case gets a real store again
  expect(await mock.entries(store)).toMatchInlineSnapshot(`
    [
      [
        "a",
        {
          "total": 2,
        },
      ],
    ]
  `)
})
