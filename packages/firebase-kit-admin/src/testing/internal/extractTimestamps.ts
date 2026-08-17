import { Timestamp } from 'firebase-admin/firestore'

export interface TimestampDebugOptions {
  logTimestamps?: boolean
  docPath?: string
}

/**
 * Extracts all unique timestamp values from an object into a Set.
 * The values are stored as strings (from timestamp.valueOf()) for easy sorting.
 *
 * This function is idempotent - calling it multiple times with the same
 * input
 * will always produce the same output, and it doesn't modify any input
 * parameters.
 *
 * @param value - The value to extract timestamps from
 * @param debugOptions - Options for debugging timestamp extraction
 * @returns A new Set containing all unique timestamp values as strings
 */
export const extractTimestamps = (
  value: unknown,
  debugOptions: TimestampDebugOptions = {},
): Set<string> => {
  const result = new Set<string>()

  // Internal recursive function that uses the result Set
  const extract = (val: unknown, currentPath = ''): void => {
    // Handle Timestamp objects
    if (val instanceof Timestamp) {
      const timeValue = val.valueOf()
      result.add(timeValue)

      // Log timestamp if debug is enabled
      if (debugOptions.logTimestamps) {
        const docPathInfo = debugOptions.docPath
          ? `in document ${debugOptions.docPath}`
          : ''
        console.log(
          `Found timestamp ${val.valueOf()} (${val.toDate().toISOString()}) at path: ${currentPath} ${docPathInfo}`,
        )
      }

      return
    }

    // Handle arrays
    if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        const itemPath = currentPath
          ? `${currentPath}[${String(i)}]`
          : `[${String(i)}]`
        extract(val[i], itemPath)
      }
      return
    }

    // Handle objects (but not null)
    if (typeof val === 'object' && val !== null) {
      for (const [key, v] of Object.entries(val)) {
        const newPath = currentPath ? `${currentPath}.${key}` : key

        extract(v, newPath)
      }
    }
  }

  // Start the extraction process
  extract(value)

  // Return the result Set
  return result
}
