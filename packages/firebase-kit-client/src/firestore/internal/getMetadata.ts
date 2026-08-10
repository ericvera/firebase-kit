import type { GetSetDelStoreToken } from 'getsetdel'
import { getMeta } from 'getsetdel'
import type { FirestoreVariant } from '../constants.js'
import { reviveTimestamps } from '../reviveTimestamps.js'
import type { CacheMetadata } from './types.js'

/**
 * Reads the since-marker a cached collection stores alongside its documents,
 * with its timestamps rebuilt — the store hands back plain data, and callers
 * compare the marker against live document timestamps.
 */
export const getMetadata = async (
  storeToken: GetSetDelStoreToken,
  variant: FirestoreVariant,
): Promise<CacheMetadata | undefined> => {
  const rawMetadata = await getMeta<CacheMetadata>(storeToken)

  return rawMetadata ? reviveTimestamps(rawMetadata, variant) : undefined
}
