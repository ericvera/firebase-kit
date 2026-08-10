/**
 * Merges cached documents with new documents, with new documents taking
 * precedence. Deduplicates by document ID.
 */
export const mergeDocumentsById = <T extends { id: string }>(
  cachedDocs: T[],
  newDocs: T[],
): T[] => {
  const allDocuments = [...cachedDocs, ...newDocs]

  return Array.from(new Map(allDocuments.map((doc) => [doc.id, doc])).values())
}
