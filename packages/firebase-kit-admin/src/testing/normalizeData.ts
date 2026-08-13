import { extractTimestamps } from './internal/extractTimestamps.js'
import { normalizeData as normalizeDataInternal } from './internal/normalizeData.js'

/**
 * Options for normalizing data
 */
export interface NormalizeDataOptions {
  /**
   * Whether to log timestamps found during extraction
   * @default false
   */
  logTimestamps?: boolean
}

/**
 * Normalizes Firestore Timestamp objects and Buffer objects in a data structure
 * by replacing them with standardized string representations.
 *
 * This is useful for creating deterministic snapshots in tests where the
 * actual
 * timestamp/buffer values may vary but their relative ordering or content
 * is what matters.
 *
 * - Timestamps are replaced with strings in the format `/Timestamp XXXX/` where
 *   XXXX is a zero-padded index representing the timestamp's position when all
 *   timestamps are sorted chronologically.
 * - Buffer objects are normalized to `/Buffer <base64url>/` format.
 *
 * @param data - The data structure containing Timestamp and Buffer objects
 *   to normalize
 * @param options - Optional configuration for the normalization process
 * @returns A new data structure with all Timestamps and Buffers replaced by
 * normalized strings.
 */
export function normalizeData<T = unknown>(
  data: T,
  options: NormalizeDataOptions = {},
): T {
  // Extract all timestamps from the data
  const timestamps = extractTimestamps(data, {
    logTimestamps: options.logTimestamps ?? false,
  })

  // Sort timestamps chronologically
  const sortedTimestamps = Array.from(timestamps).sort()

  // Log sorted timestamps if debug is enabled
  if (options.logTimestamps && sortedTimestamps.length > 0) {
    console.log('\nFound timestamps (chronological order):')

    sortedTimestamps.forEach((timestamp, index) => {
      console.log(`  ${index.toString().padStart(3, '0')}: ${timestamp}`)
    })
    console.log('')
  }

  // Normalize the data by replacing timestamps and buffers
  return normalizeDataInternal(data, sortedTimestamps) as T
}
