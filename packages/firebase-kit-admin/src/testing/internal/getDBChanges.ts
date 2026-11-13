import type { DBSnapshot } from '../getDBSnapshot.js'
import { ascCompare } from './ascCompare.js'
import type { DBSnapshotChanges } from './DocumentChangeSnapshot.js'
import {
  AddedDocumentSnapshot,
  ModifiedDocumentSnapshot,
  RemovedDocumentSnapshot,
  UnmodifiedDocumentSnapshot,
} from './DocumentChangeSnapshot.js'
import { extractTimestamps } from './extractTimestamps.js'
import { maskModifiedProps } from './maskModifiedProps.js'
import { maskProps } from './maskProps.js'
import { normalizeData } from './normalizeData.js'

/**
 * Diffs two snapshots into the added, removed, modified and unmodified
 * documents that `getDBChangesDiff` and `expectNoDBChanges` render.
 *
 * Both snapshots' `docs` arrays are sorted in place.
 */
export const getDBChanges = <TCollection extends string = string>(
  before: DBSnapshot,
  after: DBSnapshot,
  masks?: Partial<Record<TCollection, string[]>>,
): DBSnapshotChanges => {
  const beforeDocs = before.docs
  const afterDocs = after.docs

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
      // Get added docs
      const isAdded = beforeDocs.every(
        (beforeDoc) => beforeDoc.ref.path !== afterDoc.ref.path,
      )

      if (isAdded) {
        const afterMaskedData = maskProps(
          afterNormalizedData,
          afterDoc.ref.parent.id,
          maskKeys,
        )

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
      maskModifiedProps(
        beforeNormalizedData,
        afterNormalizedData,
        afterDoc.ref.parent.id,
        maskKeys,
      )

      if (!beforeDoc.updateTime.isEqual(afterDoc.updateTime)) {
        result.modified.push(
          new ModifiedDocumentSnapshot(
            beforeDoc,
            afterDoc,
            beforeNormalizedData,
            afterNormalizedData,
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
