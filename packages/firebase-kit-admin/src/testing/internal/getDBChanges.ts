import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
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
  const beforeDocs = before.docs.sort(ascCompare((a) => a.updateTime.valueOf()))
  const afterDocs = after.docs.sort(ascCompare((a) => a.updateTime.valueOf()))

  // Masks are keyed by plain string internally. The type parameter only narrows
  // what a caller may name, so widening back here loses nothing.
  const maskKeys = (masks as Record<string, string[]> | undefined) ?? {}

  const result: DBSnapshotChanges = {
    added: [],
    removed: [],
    modified: [],
    unmodified: [],
  }

  // Step 1: Mask shallow copies, because `data()` may hand back the caller's
  // own object. Masking first keeps masked timestamps out of the numbering.
  const withCopy = (doc: QueryDocumentSnapshot) => ({
    doc,
    data: { ...doc.data() },
  })
  const beforeEntries = beforeDocs.map(withCopy)
  const afterEntries = afterDocs.map(withCopy)
  const pairs = afterEntries.map((afterEntry) => ({
    afterEntry,
    beforeEntry: beforeEntries.find(
      ({ doc }) => doc.ref.path === afterEntry.doc.ref.path,
    ),
  }))
  const removedEntries = beforeEntries.filter(({ doc: beforeDoc }) =>
    afterDocs.every((afterDoc) => afterDoc.ref.path !== beforeDoc.ref.path),
  )

  pairs.forEach(({ afterEntry, beforeEntry }) => {
    const collection = afterEntry.doc.ref.parent.id

    if (beforeEntry) {
      maskModifiedProps(beforeEntry.data, afterEntry.data, collection, maskKeys)
    } else {
      maskProps(afterEntry.data, collection, maskKeys)
    }
  })

  removedEntries.forEach(({ doc, data }) => {
    maskProps(data, doc.ref.parent.id, maskKeys)
  })

  // Step 2: Index the timestamps left after masking across both snapshots
  const timestampValues = new Set<string>()
  for (const { data } of [...beforeEntries, ...afterEntries]) {
    extractTimestamps(data).forEach((value) => timestampValues.add(value))
  }
  const sortedTimestamps = Array.from(timestampValues).sort()

  const normalize = (data: Record<string, unknown>) =>
    normalizeData(data, sortedTimestamps)

  // Step 3: Classify each document by presence and updateTime
  pairs.forEach(({ afterEntry, beforeEntry }) => {
    const afterDoc = afterEntry.doc

    if (!beforeEntry) {
      result.added.push(
        new AddedDocumentSnapshot(
          afterDoc,
          normalize(afterEntry.data),
          afterDocs,
        ),
      )
      return
    }

    const beforeDoc = beforeEntry.doc

    if (!beforeDoc.updateTime.isEqual(afterDoc.updateTime)) {
      result.modified.push(
        new ModifiedDocumentSnapshot(
          beforeDoc,
          afterDoc,
          normalize(beforeEntry.data),
          normalize(afterEntry.data),
          afterDocs,
        ),
      )
    } else {
      result.unmodified.push(
        new UnmodifiedDocumentSnapshot(beforeDoc, afterDocs),
      )
    }
  })

  removedEntries.forEach(({ doc, data }) => {
    result.removed.push(
      new RemovedDocumentSnapshot(doc, normalize(data), beforeDocs),
    )
  })

  return result
}
