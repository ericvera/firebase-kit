/**
 * Returns the pattern of every level of a document path, outermost first. A
 * pattern is a path with the document ids taken out, so `spaces/entries`
 * stands for the entries of every space.
 */
export const getCollectionPatterns = (path: string): string[] => {
  const collections = path.split('/').filter((_, index) => index % 2 === 0)

  return collections.map((_, level) =>
    collections.slice(0, level + 1).join('/'),
  )
}
