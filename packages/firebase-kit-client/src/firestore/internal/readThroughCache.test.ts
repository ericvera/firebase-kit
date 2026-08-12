import { GetSetDelResetError } from 'getsetdel'
import { afterEach, expect, it, vi } from 'vitest'
import {
  ConnectionStatus,
  ConnectivityError,
} from '../../connectivity/index.js'
import type { ReadThroughCacheOptions } from './readThroughCache.js'
import { readThroughCache } from './readThroughCache.js'

interface CacheCall {
  written: string[]
  dropped: string[]
  fetches: number
  reads: number
}

const createOptions = (
  calls: CacheCall,
  overrides: Partial<ReadThroughCacheOptions<string>> = {},
): ReadThroughCacheOptions<string> => ({
  isOnline: true,
  readCache: () => {
    calls.reads += 1

    return Promise.resolve(undefined)
  },
  fetch: () => {
    calls.fetches += 1

    return Promise.resolve('fresh')
  },
  writeCache: (value) => {
    calls.written.push(value)

    return Promise.resolve()
  },
  dropCache: (value) => {
    calls.dropped.push(value)

    return Promise.resolve()
  },
  ...overrides,
})

const createCalls = (): CacheCall => ({
  written: [],
  dropped: [],
  fetches: 0,
  reads: 0,
})

afterEach(() => {
  vi.useRealTimers()
})

it('serves a fresh cache without touching the network', async () => {
  const calls = createCalls()

  const result = await readThroughCache(
    createOptions(calls, {
      readCache: () => Promise.resolve({ value: 'cached', fresh: true }),
    }),
  )

  // Verify: the saved value comes back and no fetch is issued — the whole point
  // of the fresh path
  expect(result).toEqual('cached')
  expect(calls.fetches).toEqual(0)
})

it('serves a stale cache while offline rather than failing', async () => {
  const calls = createCalls()

  const result = await readThroughCache(
    createOptions(calls, {
      isOnline: false,
      readCache: () => Promise.resolve({ value: 'cached', fresh: false }),
    }),
  )

  // Verify: offline with something saved shows the stale copy, and still makes
  // no network call
  expect(result).toEqual('cached')
  expect(calls.fetches).toEqual(0)
})

it('throws ConnectivityError when offline with nothing cached', async () => {
  const calls = createCalls()

  const failing = readThroughCache(createOptions(calls, { isOnline: false }))

  // Verify: nothing to show means the offline page, not an empty result the
  // caller would render as "no data"
  await expect(failing).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ConnectivityError: Connectivity issue: offline]`,
  )
})

it('overwrites the cache with a freshly fetched value', async () => {
  const calls = createCalls()

  const result = await readThroughCache(
    createOptions(calls, {
      readCache: () => Promise.resolve({ value: 'cached', fresh: false }),
    }),
  )

  // Verify: the fetched value is returned and written, and the stale entry is
  // replaced rather than dropped first
  expect(result).toEqual('fresh')
  expect(calls.written).toEqual(['fresh'])
  expect(calls.dropped).toEqual([])
})

it('drops the cache entry when the backend says the entity is gone', async () => {
  const calls = createCalls()

  const result = await readThroughCache(
    createOptions(calls, {
      readCache: () => Promise.resolve({ value: 'cached', fresh: false }),
      fetch: () => Promise.resolve(undefined),
    }),
  )

  // Verify: a confirmed deletion purges the saved copy and reports absence —
  // the dropped value is handed back so an adapter can purge its index entries
  expect(result).toBeUndefined()
  expect(calls.dropped).toEqual(['cached'])
  expect(calls.written).toEqual([])
})

it('serves the stale cache when the fetch fails on connectivity', async () => {
  const calls = createCalls()

  const result = await readThroughCache(
    createOptions(calls, {
      readCache: () => Promise.resolve({ value: 'cached', fresh: false }),
      fetch: () =>
        Promise.reject(new ConnectivityError(ConnectionStatus.Unstable)),
    }),
  )

  // Verify: a failed refresh leaves the saved copy intact and serves it — never
  // a delete-then-restore
  expect(result).toEqual('cached')
  expect(calls.written).toEqual([])
  expect(calls.dropped).toEqual([])
})

it('propagates a connectivity failure when there is nothing cached', async () => {
  const calls = createCalls()

  const failing = readThroughCache(
    createOptions(calls, {
      fetch: () =>
        Promise.reject(new ConnectivityError(ConnectionStatus.Offline)),
    }),
  )

  // Verify: no saved copy means the error reaches the caller, which renders the
  // blocking page
  await expect(failing).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ConnectivityError: Connectivity issue: offline]`,
  )
})

it('propagates a fatal fetch error even with a cache present', async () => {
  const calls = createCalls()

  const failing = readThroughCache(
    createOptions(calls, {
      readCache: () => Promise.resolve({ value: 'cached', fresh: false }),
      fetch: () => Promise.reject(new Error('permission denied')),
    }),
  )

  // Verify: only connectivity failures fall back to stale — a real fault must
  // not be hidden behind a saved copy
  await expect(failing).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: permission denied]`,
  )
})

it('retries the whole read after a store reset', async () => {
  vi.useFakeTimers()

  const calls = createCalls()
  let thrown = false

  const pending = readThroughCache(
    createOptions(calls, {
      readCache: () => {
        calls.reads += 1

        if (!thrown) {
          thrown = true

          return Promise.reject(
            new GetSetDelResetError('store reset', 'entries'),
          )
        }

        return Promise.resolve({ value: 'cached', fresh: true })
      },
    }),
  )

  await vi.advanceTimersByTimeAsync(1000)

  // Verify: a store reset re-runs the read from the top after backing off, and
  // the second attempt's result is what the caller gets
  await expect(pending).resolves.toEqual('cached')
  expect(calls.reads).toEqual(2)
})

it('gives up after three store resets', async () => {
  vi.useFakeTimers()

  const calls = createCalls()

  const pending = readThroughCache(
    createOptions(calls, {
      readCache: () => {
        calls.reads += 1

        return Promise.reject(new GetSetDelResetError('store reset', 'entries'))
      },
    }),
  )
  const assertion = expect(pending).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Failed to read through cache after 3 attempts]`,
  )

  await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000)

  // Verify: the loop is bounded — three attempts, then a plain error rather
  // than an endless retry against a store that keeps resetting
  await assertion
  expect(calls.reads).toEqual(3)
})
