/**
 * @fileoverview Public types of the client-side Firestore access layer — the
 * option bags each utility takes, the cache shapes they persist, and the
 * structural substitutes for the app types they used to borrow.
 */

import type { DocumentData, Query } from 'firebase/firestore'
import type {
  DocumentReference as DocumentReferenceLite,
  Query as QueryLite,
} from 'firebase/firestore/lite'
import type { DocumentCacheMetadata, TimestampProps } from './internal/types.js'

/** A Firestore document id. */
export type ID = string

/** A document paired with the id it was read under. */
export type WithID<T> = T & { id: ID }

/**
 * The Timestamp shape both Firestore SDKs share. Declared structurally rather
 * than imported, so a value from `firebase/firestore`, from
 * `firebase/firestore/lite`, or from an app's own mirrored declaration all
 * satisfy it. Only ordering and passthrough are ever done with it here.
 */
export interface FirestoreTimestamp {
  readonly seconds: number
  readonly nanoseconds: number
  toMillis: () => number
  toDate: () => Date
  isEqual: (other: FirestoreTimestamp) => boolean
  valueOf: () => string
}

/** The three methods this layer reports through. */
export interface Logger {
  log: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/**
 * Common cache store options shared across all db utilities
 */
export interface BaseCacheOptions {
  /** Unique name for the cache store */
  name: string

  /** Cache version - incrementing this will clear the existing cache */
  version?: number

  /** Optional tags for grouping related caches */
  tags?: string[]
}

/**
 * Cache options with a key for distinguishing cache instances
 */
export interface KeyedCacheOptions extends BaseCacheOptions {
  /** Optional key to further distinguish this cache */
  key?: string
}

/**
 * Cached document structure for Firestore documents
 */
export interface CachedDocument<DBT extends DocumentData> {
  /** The Firestore document data */
  data: DBT

  /** The cache metadata */
  meta: DocumentCacheMetadata
}

/**
 * Options for fetching and caching a single Firestore document
 * @template DBT - The Firestore document data type
 */
export interface GetDocWithCacheOptions<
  DBT extends DocumentData,
> extends BaseCacheOptions {
  /** The ID of the document to fetch */
  id: ID

  /** Function that returns a Firestore document reference */
  getRef: (id: ID) => Promise<DocumentReferenceLite<DBT, DBT>>

  /**
   * Function that returns true if the cache should be refreshed.
   * @param cachedItem - The cached item
   * @returns true if the cache should be refreshed
   */
  shouldRefresh?: (cachedItem: CachedDocument<DBT>) => boolean

  /** Whether running in emulator environment (skips online check) */
  inEmulator?: boolean
}

/**
 * Options for fetching and caching a Firestore collection
 * @template DBT - The Firestore document data type
 * @template T - The client-side type (DBT with id field)
 */
export interface GetDocsWithCacheOptions<
  DBT extends DocumentData,
  T extends WithID<DBT> = WithID<DBT>,
> extends KeyedCacheOptions {
  /** Optional cache key for the collection (e.g. an owning entity id) */
  key?: string

  /**
   * Property name containing the timestamp used for synchronization tracking
   */
  syncProp: TimestampProps<DBT>

  /**
   * Optional query to warm up the cache on initialization. Called when the
   * cache is empty. If not provided, getQuery will be called with undefined.
   */
  warmupQuery?: () => Promise<QueryLite<DBT, DBT>>

  /** Function that returns a Firestore query */
  getQuery: (
    updatedSince: FirestoreTimestamp | undefined,
  ) => Promise<QueryLite<DBT, DBT>>

  /**
   * Optional function to determine if a document should be removed from the
   * cache and not returned
   */
  shouldRemove?: (data: T) => boolean

  /**
   * Function that returns true if the cache should be refreshed.
   * @param cachedAt - When we last cached data (milliseconds since epoch)
   * @returns true if the cache should be refreshed
   */
  shouldRefresh?: (cachedAt: number | undefined) => boolean

  /** Whether running in emulator environment (skips online check) */
  inEmulator?: boolean
}

/**
 * Options for subscribing to and caching Firestore documents
 * @template DBT - The Firestore document data type
 * @template T - The client-side type (DBT with id field)
 */
export interface SubscribeWithCacheOptions<
  DBT extends DocumentData,
  T extends WithID<DBT> = WithID<DBT>,
> extends KeyedCacheOptions {
  /**
   * Property name containing the timestamp used for synchronization tracking
   */
  syncProp: TimestampProps<DBT>

  /**
   * Optional function to determine if a document should be removed from the
   * cache
   */
  shouldRemove?: (data: T) => boolean

  /**
   * Optional function to determine if the cache should be cleared before
   * loading cached data. If this returns true, the cache is completely cleared
   * and latestUpdated is reset to undefined.
   */
  shouldClear?: (since: FirestoreTimestamp) => boolean

  /**
   * Optional query to warm up the cache on initialization. Called when the
   * cache has not been initialized or has been cleared (via shouldClear).
   */
  warmupQuery?: () => Promise<Query<DBT, DBT>>

  /**
   * Query function that receives the since timestamp and returns a Firestore
   * query. Since timestamp is undefined if the cache has not been initialized
   * or has been cleared (via shouldClear).
   */
  subscribeQuery: (
    since: FirestoreTimestamp | undefined,
  ) => Promise<Query<DBT, DBT>>

  /** Callback fired when documents are updated with sets and removals */
  onUpdates: (updates: SubscriptionUpdate<DBT>) => void

  /**
   * Callback fired when the cache needs to be reset. This happens when the
   * store has changed since this instance of the store was created. For
   * example, if there are multiple tabs open that are using the same cache,
   * and one of them clears the cache, this callback will be called the next
   * time any cache operation is performed and it performs a store consistency
   * check.
   */
  onReset: () => void

  /**
   * Callback fired when an error occurs during subscription or updates. Those
   * errors happen asynchronously so a try/catch block on the caller of
   * subscribeAndCache will not catch them. This is not called if the error is
   * due to GetSetDelResetError in which case onReset is called instead.
   */
  onError: (error: unknown) => void

  /**
   * Returns the current auth state. Lets the listener error path distinguish
   * the signOut teardown race (permission-denied while logged out — expected,
   * suppressed) from a real denial (see subscribe).
   */
  isLoggedIn: () => boolean

  /** Whether running in emulator environment (skips online check) */
  inEmulator?: boolean
}

/**
 * Options for subscribing to Firestore document changes
 * @template DBT - The Firestore document data type
 * @template T - The client-side data type (DBT with id field)
 */
export interface SubscribeOptions<
  DBT extends DocumentData,
  T extends WithID<DBT> = WithID<DBT>,
> {
  /** Function that returns a Firestore query to subscribe to */
  subscribeQuery: () => Promise<Query<DBT, DBT>>
  /**
   * Optional function to determine if a document should be removed based on its
   * data
   */
  shouldRemove?: (data: T) => boolean
  /** Callback fired when documents are updated with sets and removals */
  onUpdates: (updates: SubscriptionUpdate<DBT>) => void
  /** Callback fired when an error occurs during subscription or updates */
  onError: (error: unknown) => void
  /**
   * Returns the current auth state. Lets the listener error path distinguish
   * the signOut teardown race (permission-denied while logged out — expected,
   * suppressed) from a real denial.
   */
  isLoggedIn: () => boolean
}

/**
 * Update data structure for subscription callbacks
 */
export interface SubscriptionUpdate<DBT extends DocumentData> {
  /** The documents to set */
  set: [ID, DBT][]

  /** The documents to remove */
  remove: ID[]
}

/**
 * Everything the client-side Firestore layer needs from the host app, each
 * collaborator already bound to it. Passed once to `createFirestoreUtils`;
 * every returned utility is bound to it.
 *
 * `withConnectivityHandling` is the same bound value the app's callable caller
 * is given, so a direct Firestore read degrades exactly like a callable
 * response rather than growing a second, subtly different copy of it.
 */
export interface FirestoreUtilsDependencies {
  /**
   * Which Firestore database a read goes to: the app's named database, or
   * `undefined` for the project default. Called per read, since a server
   * render and a browser render of the same build answer differently.
   *
   * One option rather than an id plus a separate "use it?" flag, so the pair
   * cannot disagree.
   */
  databaseId: () => string | undefined
  /**
   * Whether to force the full Firestore SDK even for a lite-variant read. A
   * test run does, because the emulator harness only wires up the full SDK.
   */
  useFullSDK: () => boolean
  /** Wraps a read so connectivity failures surface as `ConnectivityError`. */
  withConnectivityHandling: <T>(serviceCall: () => Promise<T>) => Promise<T>
  /** Builds the logger a named utility reports through. */
  createLogger: (name: string) => Logger
  /**
   * Stamped on every cache store this layer opens. Bumping it invalidates
   * every cached collection at once.
   */
  cacheVersion: number
}
