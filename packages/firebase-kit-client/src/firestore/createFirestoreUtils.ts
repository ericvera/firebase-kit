import { createGetDoc } from './internal/getDoc.js'
import { createGetDocWithCache } from './internal/getDocWithCache.js'
import { createGetDocs } from './internal/getDocs.js'
import { createGetDocsWithCache } from './internal/getDocsWithCache.js'
import { createGetDocsWithCursor } from './internal/getDocsWithCursor.js'
import { createGetHostingFirestore } from './internal/getHostingFirestore.js'
import { readThroughCache } from './internal/readThroughCache.js'
import { createSubscribe } from './internal/subscribe.js'
import { createSubscribeWithCache } from './internal/subscribeWithCache.js'
import type { FirestoreUtilsDependencies } from './types.js'

/**
 * Entry point of the `./firestore` subpath. Called once per app — from the
 * app's own database barrel, which exports the result as `db` — and returns
 * the whole browser-side Firestore access layer bound to that app: the plain
 * reads, the cached reads, the two subscriptions, the read-through cache they
 * share, and the SDK selector that decides between the named and the default
 * database.
 *
 * The counterpart of `firebase-kit-admin/firestore` on the server. Both take
 * their app's database ids and hand back an already-bound layer, so neither
 * app's call sites carry configuration.
 */
export const createFirestoreUtils = (
  dependencies: FirestoreUtilsDependencies,
) => ({
  getDoc: createGetDoc(dependencies),
  getDocWithCache: createGetDocWithCache(dependencies),
  getDocs: createGetDocs(dependencies),
  getDocsWithCache: createGetDocsWithCache(dependencies),
  getDocsWithCursor: createGetDocsWithCursor(dependencies),
  getHostingFirestore: createGetHostingFirestore(dependencies),
  readThroughCache,
  subscribe: createSubscribe(dependencies),
  subscribeWithCache: createSubscribeWithCache(dependencies),
})
