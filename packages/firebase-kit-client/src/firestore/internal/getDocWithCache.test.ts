import type { DocumentData, DocumentReference } from 'firebase/firestore/lite'
import { createStore, get, set } from 'getsetdel'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { simulateStoreReset } from '../../__mocks__/getsetdel/index.js'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import type { CachedDocument, FirestoreUtilsDependencies } from '../types.js'
import { createGetDocWithCache } from './getDocWithCache.js'

const state = vi.hoisted((): StoreState => ({
  remote: undefined,
  storeName: 'spaces',
}))

vi.mock('getsetdel')

vi.mock('firebase/firestore/lite', () => ({
  getDoc: () => Promise.resolve({ data: () => state.remote }),
}))

interface StoreState {
  /** What the SDK read returns next; undefined means the doc is gone. */
  remote: Record<string, unknown> | undefined
  /** Store name for the running case, so cases cannot see each other's data. */
  storeName: string
}

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies({
    cacheVersion: 8,
  })

const getRef = () => Promise.resolve({} as DocumentReference)

const baseOptions = () => ({ id: 'space-1', name: state.storeName, getRef })

/** Opens the same store the subject opens, to seed or read it back. */

const openStore = (version = 0) =>
  createStore({ name: state.storeName, version: version + 8 })

let caseCount = 0

beforeEach(() => {
  caseCount += 1

  // A distinct store per case, so nothing a case writes can be reached
  // through another case's store token.
  state.storeName = `spaces-${String(caseCount)}`
  state.remote = undefined
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Arms the next store open to hand back a store another tab just wiped. */
const wipeStoreOnNextOpen = () => {
  vi.mocked(createStore).mockImplementationOnce(async (storeInfo) => {
    // A once-implementation is dequeued before it runs, so this call reaches
    // the shim's delegate instead of recursing into this wrapper.
    const storeToken = await createStore(storeInfo)

    await simulateStoreReset(storeToken)

    return storeToken
  })
}

it('stops serving a cached document once the global version is bumped', async () => {
  state.remote = { name: 'A space' }

  const getDocWithCache = createGetDocWithCache(createDependencies())

  await getDocWithCache({ ...baseOptions(), shouldRefresh: () => false })

  state.remote = { name: 'A newer space' }

  const bumped = createGetDocWithCache(
    createTestFirestoreDependencies({ cacheVersion: 9 }),
  )

  const result = await bumped({ ...baseOptions(), shouldRefresh: () => false })

  // Verify: the global version participates in which store is opened, so
  // bumping it strands every cached document and the read refetches — a cache
  // the caller called fresh would otherwise have been served
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "A newer space",
    }
  `)
})

it('stops serving a cached document once the caller version is bumped', async () => {
  state.remote = { name: 'A space' }

  const getDocWithCache = createGetDocWithCache(createDependencies())

  await getDocWithCache({
    ...baseOptions(),
    version: 1,
    shouldRefresh: () => false,
  })

  state.remote = { name: 'A newer space' }

  const result = await getDocWithCache({
    ...baseOptions(),
    version: 2,
    shouldRefresh: () => false,
  })

  // Verify: the caller's own version is added to the global one rather than
  // replacing it, so a caller can invalidate just its own documents
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "A newer space",
    }
  `)
})

it('fetches and caches the document when nothing is cached', async () => {
  state.remote = { name: 'A space' }

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const result = await getDocWithCache(baseOptions())

  // Verify: the fetched document comes back id-folded, and the stored entry
  // holds the data without the id — the id is the cache key
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "A space",
    }
  `)
  const cached = await get<CachedDocument<DocumentData>>(
    await openStore(),
    'space-1',
  )

  expect(cached?.data).toMatchInlineSnapshot(`
    {
      "name": "A space",
    }
  `)
})

it('serves the cached document without fetching when shouldRefresh says no', async () => {
  await set(await openStore(), 'space-1', {
    data: { name: 'cached space' },
    meta: { cachedAt: 1 },
  })
  state.remote = { name: 'remote space' }

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const result = await getDocWithCache({
    ...baseOptions(),
    shouldRefresh: () => false,
  })

  // Verify: a cache the caller calls fresh is served as-is — the remote value
  // is never consulted
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "cached space",
    }
  `)
})

it('refreshes the cached document when shouldRefresh says so', async () => {
  await set(await openStore(), 'space-1', {
    data: { name: 'cached space' },
    meta: { cachedAt: 1 },
  })
  state.remote = { name: 'remote space' }

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const result = await getDocWithCache({
    ...baseOptions(),
    shouldRefresh: () => true,
  })

  // Verify: the stale entry is replaced by the fetched one rather than served
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "remote space",
    }
  `)
})

it('treats a document with no refresh policy as always stale', async () => {
  await set(await openStore(), 'space-1', {
    data: { name: 'cached space' },
    meta: { cachedAt: 1 },
  })
  state.remote = { name: 'remote space' }

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const result = await getDocWithCache(baseOptions())

  // Verify: without shouldRefresh the cache is a fallback, not an answer — it
  // refreshes whenever online
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "remote space",
    }
  `)
})

it('drops the cached entry when the document is gone from the backend', async () => {
  await set(await openStore(), 'space-1', {
    data: { name: 'cached space' },
    meta: { cachedAt: 1 },
  })
  state.remote = undefined

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const result = await getDocWithCache(baseOptions())

  const cached = await get<CachedDocument<DocumentData>>(
    await openStore(),
    'space-1',
  )

  // Verify: a confirmed deletion purges the saved copy and reports absence, so
  // the next read does not resurrect it
  expect(result).toBeUndefined()
  expect(cached).toBeUndefined()
})

it('serves the cached document while offline', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  await set(await openStore(), 'space-1', {
    data: { name: 'cached space' },
    meta: { cachedAt: 1 },
  })

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const result = await getDocWithCache(baseOptions())

  // Verify: offline reads fall back to the saved copy rather than failing
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "cached space",
    }
  `)
})

it('treats the emulator as online even when the browser reports offline', async () => {
  vi.stubGlobal('navigator', { onLine: false })
  state.remote = { name: 'A space' }

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const result = await getDocWithCache({ ...baseOptions(), inEmulator: true })

  // Verify: the emulator flag overrides navigator.onLine, so local development
  // against a stopped network still reaches the emulator
  expect(result).toMatchInlineSnapshot(`
    {
      "id": "space-1",
      "name": "A space",
    }
  `)
})

it('recovers when the store is wiped before the first cache read', async () => {
  vi.useFakeTimers()
  state.remote = { name: 'A space' }
  wipeStoreOnNextOpen()

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const pending = getDocWithCache(baseOptions())
  const assertion = expect(pending).resolves.toEqual({
    id: 'space-1',
    name: 'A space',
  })

  // The whole backoff schedule, so a read that never recovers reports the
  // give-up error rather than parking on a timer until the case times out.
  await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000)

  // Verify that a wipe landing before the first cache read costs one attempt
  // instead of the whole read
  await assertion

  const cached = await get<CachedDocument<DocumentData>>(
    await openStore(),
    'space-1',
  )

  // Verify that the retry wrote through a store the wipe left behind, so the
  // document is there for the next read
  expect(cached?.data).toEqual({ name: 'A space' })
})

it('recovers when the store is wiped between the cache read and the write', async () => {
  vi.useFakeTimers()
  state.remote = { name: 'A space' }

  let wiped = false

  const getDocWithCache = createGetDocWithCache(createDependencies())

  const pending = getDocWithCache({
    ...baseOptions(),
    getRef: async () => {
      // getRef runs inside the fetch, after the cache read and before the
      // write, so wiping here lands the reset between the two. Only the first
      // call wipes, otherwise the retry would be wiped as well.
      if (!wiped) {
        wiped = true

        await simulateStoreReset(await openStore())
      }

      return {} as DocumentReference
    },
  })

  const assertion = expect(pending).resolves.toEqual({
    id: 'space-1',
    name: 'A space',
  })

  await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000)

  // Verify that a wipe arriving mid-attempt is survivable wherever it lands,
  // not just before the read
  await assertion

  const cached = await get<CachedDocument<DocumentData>>(
    await openStore(),
    'space-1',
  )

  expect(cached?.data).toEqual({ name: 'A space' })
})

it('recovers three concurrent reads issued after a wipe', async () => {
  vi.useFakeTimers()
  state.remote = { name: 'A space' }

  await simulateStoreReset(await openStore())

  // getsetdel samples Date.now() only after awaiting its inventory read, so
  // three concurrent opens sample it in turn. Distinct values make them race
  // for the inventory entry, which leaves two of them holding a token the
  // store no longer matches, the way a real fan-out after a wipe does.
  let creation = Date.now()

  vi.spyOn(Date, 'now').mockImplementation(() => {
    creation += 1

    return creation
  })

  const getDocWithCache = createGetDocWithCache(createDependencies())

  // Calling the cache fresh keeps the two losers off the network on their
  // retry, because by then the winner has already cached the document. Two
  // fetches in one tick would hit the real Firestore module, which vitest
  // hands to all but the first of concurrent dynamic imports.
  const options = { ...baseOptions(), shouldRefresh: () => false }

  const reads = Promise.all([
    getDocWithCache(options),
    getDocWithCache(options),
    getDocWithCache(options),
  ])

  const expected = { id: 'space-1', name: 'A space' }
  const assertion = expect(reads).resolves.toEqual([
    expected,
    expected,
    expected,
  ])

  await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000)

  // Verify that a fan-out onto a wiped store converges on the store the
  // winning open created, rather than failing every read that lost the race
  await assertion
})
