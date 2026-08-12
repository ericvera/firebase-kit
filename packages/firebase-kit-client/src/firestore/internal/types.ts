import type { FirestoreTimestamp } from '../types.js'

/**
 * Metadata for caching collections with real-time subscriptions.
 * Tracks the latest document timestamp for incremental queries.
 */
export interface CacheMetadata {
  /**
   * The latest updated timestamp from documents we have processed.
   * Used for incremental queries to get only newer documents.
   */
  latestUpdated: FirestoreTimestamp
}

/**
 * Metadata for caching individual documents.
 */
export interface DocumentCacheMetadata {
  /**
   * When we last cached this document (milliseconds since epoch).
   */
  cachedAt: number
}

/**
 * Property name containing the timestamp used for synchronization tracking
 */
export type TimestampProps<T> = {
  [K in keyof T]: T[K] extends FirestoreTimestamp ? K : never
}[keyof T]

/**
 * Property name containing the key used for caching collections.
 */
export type CacheKeyProps<T> = {
  [K in keyof T]: T[K] extends string ? K : never
}[keyof T]
