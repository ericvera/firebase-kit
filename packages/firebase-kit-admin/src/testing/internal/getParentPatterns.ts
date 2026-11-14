import { getCollectionPatterns } from './getCollectionPatterns.js'

/**
 * Returns the patterns of the collections holding a parent of a changed
 * document. Their documents print with a number, so a parent's own section and
 * its children's sections name it the same way.
 */
export const getParentPatterns = (
  changedPaths: readonly string[],
): Set<string> =>
  new Set(
    changedPaths.flatMap((path) => getCollectionPatterns(path).slice(0, -1)),
  )
