import { getCollectionPatterns } from './getCollectionPatterns.js'

/** One `collection/document` pair of a document path as the diff prints it. */
export interface DocPathSegment {
  collection: string
  /**
   * The document's number among its siblings, printed as `[ID n]`. Undefined
   * when the diff holds nothing from a subcollection of its collection, so it
   * prints as `[ID]`.
   */
  number: number | undefined
}

/**
 * Splits a document path into the segments the diff prints. Every ancestor
 * carries its number. The document itself carries one only when its
 * collection is in `parentPatterns`. Every ancestor must be in `numbers`.
 */
export const getDocPathSegments = (
  path: string,
  numbers: ReadonlyMap<string, number>,
  parentPatterns: ReadonlySet<string>,
): DocPathSegment[] => {
  const parts = path.split('/')
  const patterns = getCollectionPatterns(path)

  return patterns.map((pattern, level) => {
    const collectionPath = parts.slice(0, level * 2 + 1).join('/')
    const docPath = parts.slice(0, level * 2 + 2).join('/')
    const isAncestor = level < patterns.length - 1
    const number = numbers.get(docPath)

    if (isAncestor && number === undefined) {
      throw new Error(
        `Document not found for path: ${docPath} (an ancestor of ${path}). Add a ref or query covering the ${collectionPath} collection to getDBSnapshot, so the ancestor is in the snapshot.`,
      )
    }

    return {
      collection: parts[level * 2] ?? '',
      number: isAncestor || parentPatterns.has(pattern) ? number : undefined,
    }
  })
}
