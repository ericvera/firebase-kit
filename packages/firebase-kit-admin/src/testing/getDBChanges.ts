import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { ascCompare } from './internal/ascCompare.js'
import type { DBSnapshotChanges } from './internal/DocumentChangeSnapshot.js'
import {
  AddedDocumentSnapshot,
  ModifiedDocumentSnapshot,
  RemovedDocumentSnapshot,
  UnmodifiedDocumentSnapshot,
} from './internal/DocumentChangeSnapshot.js'
import { extractTimestamps } from './internal/extractTimestamps.js'
import { maskProps } from './internal/maskProps.js'
import { normalizeData } from './internal/normalizeData.js'

/**
 * Diffs two `getDBSnapshot` results into added, modified and removed documents.
 * `masks` drops per-collection fields whose values are not stable enough to
 * assert on; the type parameter lets an app key it by its own collection enum
 * so a typo in a collection name fails to compile.
 *
 * Both snapshot arrays are sorted in place.
 */
export const getDBChanges = <TCollection extends string = string>(
  beforeDocs: QueryDocumentSnapshot[],
  afterDocs: QueryDocumentSnapshot[],
  masks?: Partial<Record<TCollection, string[]>>,
): DBSnapshotChanges => {
  // Masks are keyed by plain string internally; the type parameter only narrows
  // what a caller may name, so widening back here loses nothing.
  const maskKeys = (masks as Record<string, string[]> | undefined) ?? {}

  const result: DBSnapshotChanges = {
    added: [],
    removed: [],
    modified: [],
    unmodified: [],
  }

  // Step 1: Extract all unique timestamps from all documents
  let timestampValues = new Set<string>()

  // Collect timestamps from beforeDocs
  beforeDocs.forEach((doc) => {
    // Merge the extracted timestamps into our set
    const docTimestamps = extractTimestamps(doc.data())
    timestampValues = new Set([...timestampValues, ...docTimestamps])
  })

  // Collect timestamps from afterDocs
  afterDocs.forEach((doc) => {
    // Merge the extracted timestamps into our set
    const docTimestamps = extractTimestamps(doc.data())
    timestampValues = new Set([...timestampValues, ...docTimestamps])
  })

  // Step 2: Sort timestamps chronologically
  const sortedTimestamps = Array.from(timestampValues).sort()

  // Step 3: Normalize all documents by replacing timestamps
  const beforeDocsNormalized = beforeDocs
    .sort(ascCompare((a) => a.updateTime.valueOf()))
    .map((doc) => {
      const normalizedData = normalizeData(doc.data(), sortedTimestamps)
      return { doc, normalizedData }
    })

  const afterDocsNormalized = afterDocs
    .sort(ascCompare((a) => a.updateTime.valueOf()))
    .map((doc) => {
      const normalizedData = normalizeData(doc.data(), sortedTimestamps)
      return { doc, normalizedData }
    })

  // Process added and modified docs
  afterDocsNormalized.forEach(
    ({ doc: afterDoc, normalizedData: afterNormalizedData }) => {
      const afterMaskedData = maskProps(
        afterNormalizedData,
        afterDoc.ref.parent.id,
        maskKeys,
      )

      // Get added docs
      const isAdded = beforeDocs.every(
        (beforeDoc) => beforeDoc.ref.path !== afterDoc.ref.path,
      )

      if (isAdded) {
        result.added.push(
          new AddedDocumentSnapshot(afterDoc, afterMaskedData, afterDocs),
        )
        return
      }

      // Get modified and unmodified docs
      const beforeDocData = beforeDocsNormalized.find(
        ({ doc }) => doc.ref.path === afterDoc.ref.path,
      )

      if (!beforeDocData) {
        return
      }

      const { doc: beforeDoc, normalizedData: beforeNormalizedData } =
        beforeDocData
      const beforeMaskedData = maskProps(
        beforeNormalizedData,
        beforeDoc.ref.parent.id,
        maskKeys,
      )

      if (!beforeDoc.updateTime.isEqual(afterDoc.updateTime)) {
        result.modified.push(
          new ModifiedDocumentSnapshot(
            beforeDoc,
            afterDoc,
            beforeMaskedData,
            afterMaskedData,
            afterDocs,
          ),
        )
      } else {
        result.unmodified.push(
          new UnmodifiedDocumentSnapshot(beforeDoc, afterDocs),
        )
      }
    },
  )

  // Process removed docs
  beforeDocsNormalized.forEach(
    ({ doc: beforeDoc, normalizedData: beforeNormalizedData }) => {
      const isRemoved = afterDocs.every(
        (afterDoc) => afterDoc.ref.path !== beforeDoc.ref.path,
      )

      if (isRemoved) {
        const beforeMaskedData = maskProps(
          beforeNormalizedData,
          beforeDoc.ref.parent.id,
          maskKeys,
        )

        result.removed.push(
          new RemovedDocumentSnapshot(beforeDoc, beforeMaskedData, beforeDocs),
        )
      }
    },
  )

  return result
}
