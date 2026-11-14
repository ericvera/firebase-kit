import { compareCodeUnits } from './compareCodeUnits.js'
import type { DocPathSegment } from './getDocPathSegments.js'

/**
 * Orders two paths so that a document sorts directly ahead of the documents
 * in its subcollections, and siblings sort by number.
 */
export const compareDocPaths = (
  a: readonly DocPathSegment[],
  b: readonly DocPathSegment[],
): number => {
  for (const [level, segmentA] of a.entries()) {
    const segmentB = b[level]

    if (!segmentB) {
      return 1
    }

    const byCollection = compareCodeUnits(
      segmentA.collection,
      segmentB.collection,
    )

    if (byCollection !== 0) {
      return byCollection
    }

    const byNumber = (segmentA.number ?? 0) - (segmentB.number ?? 0)

    if (byNumber !== 0) {
      return byNumber
    }
  }

  return a.length - b.length
}
