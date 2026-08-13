import type { DocumentData, DocumentReference } from 'firebase/firestore/lite'
import { createStore, get, set } from 'getsetdel'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import type { CachedDocument, FirestoreUtilsDependencies } from '../types.js'
import { createGetDocWithCache } from './getDocWithCache.js'

interface StoreState {
  /** What the SDK read returns next; undefined means the doc is gone. */
  remote: Record<string, unknown> | undefined
  /** Store name for the running case, so cases cannot see each other's data. */
  storeName: string
}

const state = vi.hoisted((): StoreState => ({
  remote: undefined,
  storeName: 'spaces',
}))

vi.mock('firebase/firestore/lite', () => ({
  getDoc: () => Promise.resolve({ data: () => state.remote }),
}))

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
})

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
