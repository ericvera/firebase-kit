import type { DocumentData, Query } from 'firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import {
  createStore,
  getMeta,
  GetSetDelResetError,
  entries as readEntries,
  setMany,
  setMeta,
} from 'getsetdel'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  clearEntriesFault,
  failEntriesWith,
  resetGetSetDelMock,
} from '../../__mocks__/getsetdel/index.js'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import type {
  FirestoreUtilsDependencies,
  SubscriptionUpdate,
} from '../types.js'
import { createSubscribeWithCache } from './subscribeWithCache.js'

interface CacheState {
  /** Store name for the running case, so cases cannot see each other's data. */
  storeName: string
  /** Documents the warmup query returns. */
  warmup: { id: string; data: DocumentData }[]
  /** Handler the listener registered, so a test can push a snapshot. */
  onNext: ((snapshot: unknown) => void) | undefined
}

const state = vi.hoisted((): CacheState => ({
  storeName: 'entries',
  warmup: [],
  onNext: undefined,
}))

vi.mock('getsetdel')

vi.mock('firebase/firestore', async () => {
  // Only the two query entry points are faked — `Timestamp` stays the real
  // class so fixtures are the same objects production stores and reads.
  const actual =
    await vi.importActual<typeof import('firebase/firestore')>(
      'firebase/firestore',
    )

  return {
    ...actual,
    getDocs: () =>
      Promise.resolve({
        docs: state.warmup.map((doc) => ({ id: doc.id, data: () => doc.data })),
      }),
    onSnapshot: (_query: unknown, onNext: (snapshot: unknown) => void) => {
      state.onNext = onNext

      return () => undefined
    },
  }
})

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies({
    cacheVersion: 8,
  })

/** Opens the same store the subject opens, to seed it or read it back. */
const openStore = () => createStore({ name: state.storeName, version: 8 })

/** Writes entries into the store the subject will read. */
const seedStore = async (seeded: [string, DocumentData][]): Promise<void> => {
  await setMany(await openStore(), seeded)
}

/** Writes the since-marker the subject reads to decide how to query. */
const seedMeta = async (latestUpdated: unknown): Promise<void> => {
  await setMeta(await openStore(), { latestUpdated })
}

/** Ids the store holds, in key order. */
const storedIds = async (): Promise<string[]> =>
  (await readEntries<DocumentData>(await openStore())).map(([id]) => id)

/** The since-marker the store holds, if any. */
const storedMeta = async (): Promise<unknown> => getMeta(await openStore())

const createOptions = (overrides: Record<string, unknown> = {}) => ({
  name: state.storeName,
  syncProp: 'updated' as const,
  subscribeQuery: () => Promise.resolve({} as Query),
  onUpdates: () => undefined,
  onReset: () => undefined,
  onError: () => undefined,
  isLoggedIn: () => true,
  ...overrides,
})

let caseCount = 0

beforeEach(() => {
  caseCount += 1

  // A distinct store per case, since the in-memory IndexedDB outlives them.
  state.storeName = `entries-${String(caseCount)}`
  state.warmup = []
  state.onNext = undefined
  resetGetSetDelMock()
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('emits the cached documents before the listener opens', async () => {
  await seedMeta(new Timestamp(10, 0))
  await seedStore([['entry-1', { updated: new Timestamp(10, 0), total: 100 }]])

  const updates: SubscriptionUpdate<DocumentData>[] = []
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  await subscribeWithCache(
    createOptions({ onUpdates: (u: never) => updates.push(u) }),
  )

  // Verify: the first emission is the cache, so a page paints from disk before
  // the network answers
  expect(updates[0]?.set.map(([id]) => id)).toEqual(['entry-1'])
  expect(updates[0]?.remove).toEqual([])
})

it('drops cached documents the caller wants removed', async () => {
  await seedMeta(new Timestamp(10, 0))
  await seedStore([
    ['entry-1', { updated: new Timestamp(10, 0), cancelled: true }],
    ['entry-2', { updated: new Timestamp(10, 0), cancelled: false }],
  ])

  const updates: SubscriptionUpdate<DocumentData>[] = []
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  await subscribeWithCache(
    createOptions({
      onUpdates: (u: never) => updates.push(u),
      shouldRemove: (doc: { cancelled?: boolean }) => Boolean(doc.cancelled),
    }),
  )

  // Verify: the removable entry is purged from the store and left out of the
  // first emission
  expect(await storedIds()).toEqual(['entry-2'])
  expect(updates[0]?.set.map(([id]) => id)).toEqual(['entry-2'])
})

it('clears the store and re-warms when shouldClear says so', async () => {
  await seedMeta(new Timestamp(10, 0))
  await seedStore([['entry-1', { updated: new Timestamp(10, 0) }]])
  state.warmup = [{ id: 'entry-2', data: { updated: new Timestamp(20, 0) } }]

  const updates: SubscriptionUpdate<DocumentData>[] = []
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  await subscribeWithCache(
    createOptions({
      onUpdates: (u: never) => updates.push(u),
      shouldClear: () => true,
      warmupQuery: () => Promise.resolve({} as Query),
    }),
  )

  // Verify: the stale cache is wiped and the warmup query repopulates it, so
  // the first emission holds only the re-fetched document
  expect(await storedIds()).toEqual(['entry-2'])
  expect(updates[0]?.set.map(([id]) => id)).toEqual(['entry-2'])
})

it('runs the warmup query when the cache holds no metadata', async () => {
  state.warmup = [{ id: 'entry-1', data: { updated: new Timestamp(20, 0) } }]

  const updates: SubscriptionUpdate<DocumentData>[] = []
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  await subscribeWithCache(
    createOptions({
      onUpdates: (u: never) => updates.push(u),
      warmupQuery: () => Promise.resolve({} as Query),
    }),
  )

  // Verify: a cold cache is warmed and both the documents and the resulting
  // since-timestamp are persisted
  expect(await storedIds()).toEqual(['entry-1'])
  expect(await storedMeta()).toBeDefined()
  expect(updates[0]?.set.map(([id]) => id)).toEqual(['entry-1'])
})

it('serves the cache and skips the listener while offline', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  await seedMeta(new Timestamp(10, 0))
  await seedStore([['entry-1', { updated: new Timestamp(10, 0) }]])

  const updates: SubscriptionUpdate<DocumentData>[] = []
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  const unsubscribe = await subscribeWithCache(
    createOptions({ onUpdates: (u: never) => updates.push(u) }),
  )

  // Verify: offline emits the cache once and returns a no-op teardown — no
  // listener is opened against a network that is not there
  expect(updates[0]?.set.map(([id]) => id)).toEqual(['entry-1'])
  expect(state.onNext).toBeUndefined()
  expect(() => {
    unsubscribe()
  }).not.toThrow()
})

it('persists and forwards a live update from the listener', async () => {
  const updates: SubscriptionUpdate<DocumentData>[] = []
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  await subscribeWithCache(
    createOptions({ onUpdates: (u: never) => updates.push(u) }),
  )

  state.onNext?.({
    docChanges: () => [
      {
        type: 'added',
        doc: {
          id: 'entry-9',
          data: () => ({ updated: new Timestamp(50, 0), total: 900 }),
        },
      },
    ],
  })

  await vi.waitFor(async () => {
    expect(await storedIds()).toHaveLength(1)
  })

  // Verify: the live document reaches the caller and the store, and the
  // since-timestamp advances so a reconnect resumes from it
  expect(updates.at(-1)?.set.map(([id]) => id)).toEqual(['entry-9'])
  expect(await storedIds()).toEqual(['entry-9'])
  expect(await storedMeta()).toBeDefined()
})

it('routes a live document the caller wants removed into the remove list', async () => {
  const updates: SubscriptionUpdate<DocumentData>[] = []
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  await subscribeWithCache(
    createOptions({
      onUpdates: (u: never) => updates.push(u),
      shouldRemove: (doc: { cancelled?: boolean }) => Boolean(doc.cancelled),
    }),
  )

  state.onNext?.({
    docChanges: () => [
      {
        type: 'modified',
        doc: {
          id: 'entry-9',
          data: () => ({ updated: new Timestamp(50, 0), cancelled: true }),
        },
      },
    ],
  })

  await vi.waitFor(async () => {
    expect(await storedIds()).toEqual([])
  })

  // Verify: a document that becomes removable is deleted from the store rather
  // than written, and reported as a removal
  expect(updates.at(-1)?.remove).toEqual(['entry-9'])
  expect(await storedIds()).toEqual([])
})

it('calls onReset instead of throwing when the store resets during setup', async () => {
  await seedMeta(new Timestamp(10, 0))
  failEntriesWith(new GetSetDelResetError('store reset', 'entries'))

  let resets = 0
  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  const unsubscribe = await subscribeWithCache(
    createOptions({ onReset: () => (resets += 1) }),
  )

  // Verify: another tab clearing the store is recoverable — the caller is told
  // to reset and gets a no-op teardown rather than an exception
  expect(resets).toEqual(1)
  expect(() => {
    unsubscribe()
  }).not.toThrow()
})

it('propagates a non-reset failure while reading the cache', async () => {
  await seedMeta(new Timestamp(10, 0))
  failEntriesWith(new Error('corrupt entry'))

  const subscribeWithCache = createSubscribeWithCache(createDependencies())

  // Verify: a real fault is not hidden behind onReset, and the cache is cleared
  // on the way out so the next attempt starts clean
  await expect(
    subscribeWithCache(createOptions()),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: corrupt entry]`)

  // Disarmed before reading back, so the teardown's own read is not caught by
  // a fault that has already done its job.
  clearEntriesFault()

  expect(await storedIds()).toEqual([])
})
