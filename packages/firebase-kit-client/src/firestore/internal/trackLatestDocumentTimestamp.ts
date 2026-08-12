import type { FirestoreTimestamp } from '../types.js'
import { maxTimestamp } from './maxTimestamp.js'
import type { TimestampProps } from './types.js'

/**
 * Tracks the latest document timestamp from a collection of documents.
 * Used for incremental queries to determine the "since" parameter.
 */
export const trackLatestDocumentTimestamp = <T extends Record<string, unknown>>(
  currentLatest: FirestoreTimestamp | undefined,
  document: T,
  syncProp: TimestampProps<T>,
): FirestoreTimestamp | undefined => {
  const docTimestamp = document[syncProp] as FirestoreTimestamp | undefined

  if (!docTimestamp) {
    return currentLatest
  }

  return currentLatest
    ? maxTimestamp(currentLatest, docTimestamp)
    : docTimestamp
}
