import { Timestamp } from 'firebase-admin/firestore'
import { Buffer } from 'node:buffer'

/**
 * Normalizes data by replacing all Timestamp and Buffer objects with
 * standardized string representations.
 *
 * For Timestamps: /Timestamp 0000/ where the number represents the timestamp's
 * position in the provided sorted array.
 *
 * For Buffers: /Buffer <base64url>/ where the base64url is the
 * base64url-encoded value of the buffer.
 *
 * This function is idempotent - calling it multiple times with the same input
 * will always produce the same output, and it doesn't modify any input
 * parameters.
 *
 * @param value - The value to process
 * @param sortedTimestamps - Array of timestamp values (from valueOf()) sorted
 * chronologically
 * @returns A new value with timestamps and buffers replaced by their normalized
 * representations
 */
export const normalizeData = (
  value: unknown,
  sortedTimestamps: string[],
): unknown => {
  // Handle Timestamp objects
  if (value instanceof Timestamp) {
    const timeValue = value.valueOf()
    const index = sortedTimestamps.indexOf(timeValue)

    // Timestamp not found in sorted array
    if (index === -1) {
      throw new Error('Timestamp not found in sorted array')
    }

    // Format: /Timestamp 0000/ - zero-padded index in the sorted array
    return `/Timestamp ${index.toString().padStart(4, '0')}/`
  }

  // Handle Buffer objects
  if (Buffer.isBuffer(value)) {
    return `/Buffer ${value.toString('base64url')}/`
  }

  // Handle arrays - create a new array to avoid modifying the input
  if (Array.isArray(value)) {
    return value.map((item) => normalizeData(item, sortedTimestamps))
  }

  // Handle objects (but not null) - create a new object to avoid modifying
  // the input
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {}

    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = normalizeData(val, sortedTimestamps)
    }

    return result
  }

  // For primitive values, return as is
  return value
}
