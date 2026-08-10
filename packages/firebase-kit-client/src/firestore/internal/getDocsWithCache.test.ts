import type { DocumentData, Query } from 'firebase/firestore/lite'
import { Timestamp } from 'firebase/firestore/lite'
import {
  createStore,
  GetSetDelResetError,
  entries as readEntries,
  setMany,
} from 'getsetdel'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  clearEntriesFault,
  failEntriesWith,
  resetGetSetDelMock,
  stubStore,
} from '../../__mocks__/getsetdel/index.js'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import {
  ConnectionStatus,
  ConnectivityError,
} from '../../connectivity/index.js'
import type {
  CachedDocument,
  FirestoreTimestamp,
  FirestoreUtilsDependencies,
} from '../types.js'
import { createGetDocsWithCache } from './getDocsWithCache.js'

interface CollectionState {
  /** Store name for the running case, so cases cannot see each other's data. */
  storeName: string
  /** Documents the SDK returns for the next query. */
  remote: { id: string; data: Record<string, unknown> }[]
  /** Whether getQuery or warmupQuery built the query that was run. */
  queriedVia: string[]
  /** The since-timestamp getQuery was called with. */
  querySince: (FirestoreTimestamp | undefined)[]
  /** Set to make the fetch fail instead of resolving. */
  fetchError: Error | undefined
}

const state = vi.hoisted((): CollectionState => ({
  storeName: 'entries',
  remote: [],
  queriedVia: [],
  querySince: [],
  fetchError: undefined,
}))

vi.mock('getsetdel')

vi.mock('firebase/firestore/lite', async () => {
  // Only `getDocs` is faked — `Timestamp` stays the real class so fixtures are
  // the same objects production stores and reads.
  const actual = await vi.importActual<
    typeof import('firebase/firestore/lite')
  >('firebase/firestore/lite')

  return {
    ...actual,
    getDocs: () => {
      if (state.fetchError !== undefined) {
        return Promise.reject(state.fetchError)
      }

      return Promise.resolve({
        docs: state.remote.map((doc) => ({ id: doc.id, data: () => doc.data })),
      })
    },
  }
})

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies({
    cacheVersion: 8,
  })

const query = {} as Query

const baseOptions = () => ({
  name: state.storeName,
  syncProp: 'updated' as const,
  getQuery: (since: FirestoreTimestamp | undefined) => {
    state.queriedVia.push('getQuery')
    state.querySince.push(since)

    return Promise.resolve(query)
  },
})

/** Opens the same store the subject opens, to seed it or read it back. */
const openStore = () => createStore({ name: state.storeName, version: 8 })

/** Writes entries into the store the subject will read. */
const seedStore = async (
  seeded: [string, CachedDocument<DocumentData>][],
): Promise<void> => {
  await setMany(await openStore(), seeded)
}

/** Ids the store holds after the case, in key order. */
const storedIds = async (): Promise<string[]> =>
  (await readEntries<CachedDocument<DocumentData>>(await openStore())).map(
    ([id]) => id,
  )

let caseCount = 0

beforeEach(() => {
  caseCount += 1

  // A distinct store per case, since the in-memory IndexedDB outlives them.
  state.storeName = `entries-${String(caseCount)}`
  state.remote = []
  state.queriedVia = []
  state.querySince = []
  state.fetchError = undefined
  resetGetSetDelMock()
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('fetches through the warmup query when the cache is empty', async () => {
  // Plain, because it is written to the store — structured clone drops the
  // methods a Firestore Timestamp keeps on its prototype.
  state.remote = [{ id: 'entry-1', data: { updated: new Timestamp(10, 0) } }]

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  await getDocsWithCache({
    ...baseOptions(),
    warmupQuery: () => {
      state.queriedVia.push('warmupQuery')

      return Promise.resolve(query)
    },
  })

  // Verify: with nothing cached there is no since-timestamp, so the unbounded
  // warmup query runs instead of the incremental one
  expect(state.queriedVia).toEqual(['warmupQuery'])
})

it('queries incrementally from the latest cached timestamp', async () => {
  // Newest first on purpose: `maxTimestamp` compares with `>`, which on two
  // un-revived plain objects is always false and would then return whichever
  // came last. Ordering it this way means only a real comparison picks 30.
  await seedStore([
    [
      'entry-1',
      { data: { updated: new Timestamp(30, 0) }, meta: { cachedAt: 1 } },
    ],
    [
      'entry-2',
      { data: { updated: new Timestamp(10, 0) }, meta: { cachedAt: 2 } },
    ],
  ])

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  await getDocsWithCache(baseOptions())

  // Verify: the since-timestamp is the newest across the cache, not the first
  // or last entry read — anything older would re-fetch documents already held
  expect(state.querySince[0]?.seconds).toEqual(30)
})

it('merges fetched documents over the cached ones', async () => {
  await seedStore([
    ['entry-1', { data: { total: 100 }, meta: { cachedAt: 1 } }],
  ])
  state.remote = [
    { id: 'entry-1', data: { total: 999 } },
    { id: 'entry-2', data: { total: 250 } },
  ]

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const result = await getDocsWithCache(baseOptions())

  // Verify: the refetched entry-1 wins over its cached copy rather than
  // appearing twice, and the new entry-2 is appended
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "id": "entry-1",
        "total": 999,
      },
      {
        "id": "entry-2",
        "total": 250,
      },
    ]
  `)
})

it('drops cached documents the caller wants removed', async () => {
  await seedStore([
    ['entry-1', { data: { cancelled: true }, meta: { cachedAt: 1 } }],
    ['entry-2', { data: { cancelled: false }, meta: { cachedAt: 1 } }],
  ])

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const result = await getDocsWithCache({
    ...baseOptions(),
    shouldRemove: (doc) => Boolean((doc as { cancelled?: boolean }).cancelled),
  })

  // Verify: the removed entry is purged from the store and never reaches the
  // caller, while the kept one does
  expect(await storedIds()).toEqual(['entry-2'])
  expect(result.map((doc) => doc.id)).toEqual(['entry-2'])
})

it('drops fetched documents the caller wants removed', async () => {
  state.remote = [
    { id: 'entry-1', data: { cancelled: true } },
    { id: 'entry-2', data: { cancelled: false } },
  ]

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const result = await getDocsWithCache({
    ...baseOptions(),
    shouldRemove: (doc) => Boolean((doc as { cancelled?: boolean }).cancelled),
  })

  // Verify: a document that arrives already removable is purged rather than
  // cached, so it cannot come back on the next read
  expect(await storedIds()).toEqual(['entry-2'])
  expect(result.map((doc) => doc.id)).toEqual(['entry-2'])
})

it('serves the cache without fetching while offline', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  await seedStore([
    ['entry-1', { data: { total: 100 }, meta: { cachedAt: 1 } }],
  ])

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const result = await getDocsWithCache(baseOptions())

  // Verify: the offline shortcut returns before any query is built
  expect(state.queriedVia).toEqual([])
  expect(result.map((doc) => doc.id)).toEqual(['entry-1'])
})

it('serves the cache without fetching when shouldRefresh says no', async () => {
  await seedStore([
    ['entry-1', { data: { total: 100 }, meta: { cachedAt: 5 } }],
  ])

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const result = await getDocsWithCache({
    ...baseOptions(),
    shouldRefresh: () => false,
  })

  // Verify: a cache the caller calls fresh short-circuits the network entirely
  expect(state.queriedVia).toEqual([])
  expect(result.map((doc) => doc.id)).toEqual(['entry-1'])
})

it('passes the oldest cache time to the refresh decision', async () => {
  await seedStore([
    ['entry-1', { data: { total: 100 }, meta: { cachedAt: 500 } }],
    ['entry-2', { data: { total: 200 }, meta: { cachedAt: 100 } }],
  ])

  const seen: (number | undefined)[] = []
  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  await getDocsWithCache({
    ...baseOptions(),
    shouldRefresh: (cachedAt) => {
      seen.push(cachedAt)

      return false
    },
  })

  // Verify: the collection is judged by its stalest document, not its newest
  expect(seen).toEqual([100])
})

it('falls back to the cache when the fetch fails on connectivity', async () => {
  await seedStore([
    ['entry-1', { data: { total: 100 }, meta: { cachedAt: 1 } }],
  ])
  state.fetchError = new ConnectivityError(ConnectionStatus.Unstable)

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const result = await getDocsWithCache(baseOptions())

  // Verify: a failed refresh serves what is held rather than surfacing an error
  expect(result.map((doc) => doc.id)).toEqual(['entry-1'])
})

it('propagates a connectivity failure when the cache is empty', async () => {
  state.fetchError = new ConnectivityError(ConnectionStatus.Offline)

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  // Verify: with nothing to fall back on the caller gets the offline error
  await expect(
    getDocsWithCache(baseOptions()),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[ConnectivityError: Connectivity issue: offline]`,
  )
})

it('propagates a fatal fetch error even with a cache present', async () => {
  await seedStore([
    ['entry-1', { data: { total: 100 }, meta: { cachedAt: 1 } }],
  ])
  state.fetchError = new Error('permission denied')

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  // Verify: only connectivity failures fall back — a real fault is not masked
  // by serving stale data
  await expect(
    getDocsWithCache(baseOptions()),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: permission denied]`)
})

it('retries the whole read after a store reset', async () => {
  vi.useFakeTimers()

  stubStore()
  failEntriesWith(new GetSetDelResetError('store reset', 'entries'))
  state.remote = [{ id: 'entry-1', data: { total: 250 } }]

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const pending = getDocsWithCache(baseOptions())

  // The store recovers once the first attempt has backed off.
  clearEntriesFault()

  await vi.advanceTimersByTimeAsync(1000)

  // Verify: a reset restarts the read from the top rather than failing, and
  // the second attempt's documents are what the caller gets
  await expect(pending).resolves.toMatchInlineSnapshot(`
    [
      {
        "id": "entry-1",
        "total": 250,
      },
    ]
  `)
})

it('gives up after three store resets', async () => {
  vi.useFakeTimers()

  stubStore()
  failEntriesWith(new GetSetDelResetError('store reset', 'entries'))

  const getDocsWithCache = createGetDocsWithCache(createDependencies())

  const pending = getDocsWithCache(baseOptions())
  const assertion = expect(pending).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Failed to get and cache docs after 3 attempts]`,
  )

  await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000)

  // Verify: the loop is bounded — three attempts, then a plain error rather
  // than retrying forever against a store that keeps resetting
  await assertion
})
