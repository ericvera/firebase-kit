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
 * The browser-side Firestore access layer `createFirestoreUtils` returns.
 *
 * Every member is written as `ReturnType<typeof …>` rather than spelled out,
 * because declaration emit echoes that form verbatim and rewrites only the
 * value reference to a relative specifier. Left inferred, the emitted
 * signatures name `@firebase/firestore` and `@firebase/firestore/lite` — where
 * the `firebase/firestore(/lite)` barrels re-export their symbols from, and
 * which this package does not declare.
 */
export interface FirestoreUtils {
  getDoc: ReturnType<typeof createGetDoc>
  getDocWithCache: ReturnType<typeof createGetDocWithCache>
  getDocs: ReturnType<typeof createGetDocs>
  getDocsWithCache: ReturnType<typeof createGetDocsWithCache>
  getDocsWithCursor: ReturnType<typeof createGetDocsWithCursor>
  getHostingFirestore: ReturnType<typeof createGetHostingFirestore>
  readThroughCache: typeof readThroughCache
  subscribe: ReturnType<typeof createSubscribe>
  subscribeWithCache: ReturnType<typeof createSubscribeWithCache>
}

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
): FirestoreUtils => ({
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
