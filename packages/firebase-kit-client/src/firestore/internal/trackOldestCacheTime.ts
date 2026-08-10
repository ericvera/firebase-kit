/**
 * Tracks the oldest cache timestamp from cached documents.
 * Used for cache staleness decisions.
 */
export const trackOldestCacheTime = (
  currentOldest: number | undefined,
  cachedAt: number,
): number =>
  // Explicit undefined check rather than a truthiness one: epoch zero is a
  // legitimate cache time and must not read as "nothing tracked yet".
  currentOldest === undefined ? cachedAt : Math.min(currentOldest, cachedAt)
