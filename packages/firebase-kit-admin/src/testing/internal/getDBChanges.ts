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
import { getDocNumbers } from './getDocNumbers.js'
import { getDocPathSegments } from './getDocPathSegments.js'
import { getParentPatterns } from './getParentPatterns.js'
import { maskModifiedProps } from './maskModifiedProps.js'
import { maskProps } from './maskProps.js'
import { normalizeData } from './normalizeData.js'

/**
 * Diffs two snapshots into the added, removed, modified and unmodified
 * documents that `getDBChangesDiff` and `expectNoDBChanges` render.
 *
 * Both snapshots' `docs` arrays are sorted in place.
 */
export const getDBChanges = (
  before: DBSnapshot,
  after: DBSnapshot,
  masks?: Partial<Record<string, readonly string[]>>,
): DBSnapshotChanges => {
  const beforeDocs = before.docs.sort(ascCompare((a) => a.updateTime.valueOf()))
  const afterDocs = after.docs.sort(ascCompare((a) => a.updateTime.valueOf()))

  const maskKeys = masks ?? {}

  const result: DBSnapshotChanges = {
    added: [],
    removed: [],
    modified: [],
    unmodified: [],
  }

  // Step 1: Mask shallow copies, because `data()` may hand back the caller's
  // own object. Masking copies the nested maps along a masked path itself, so
  // a shallow copy here is enough. Masking first keeps masked timestamps out of
  // the numbering.
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

  // Step 3: Number every document among its siblings. A document that existed
  // before the test is ranked by what it held then, so nothing the code under
  // test writes to it can renumber it.
  const numbers = getDocNumbers([
    ...beforeDocs.map((doc) => ({
      path: doc.ref.path,
      existedBefore: true,
      content: normalize(
        maskProps({ ...doc.data() }, doc.ref.parent.id, maskKeys),
      ),
    })),
    ...pairs
      .filter(({ beforeEntry }) => !beforeEntry)
      .map(({ afterEntry }) => ({
        path: afterEntry.doc.ref.path,
        existedBefore: false,
        content: normalize(afterEntry.data),
      })),
  ])

  // Step 4: Classify each document by presence and updateTime
  const isChanged = ({ afterEntry, beforeEntry }: (typeof pairs)[number]) =>
    !beforeEntry?.doc.updateTime.isEqual(afterEntry.doc.updateTime)

  const parentPatterns = getParentPatterns([
    ...pairs.filter(isChanged).map(({ afterEntry }) => afterEntry.doc.ref.path),
    ...removedEntries.map(({ doc }) => doc.ref.path),
  ])

  const toPathSegments = (doc: QueryDocumentSnapshot) =>
    getDocPathSegments(doc.ref.path, numbers, parentPatterns)

  pairs.forEach((pair) => {
    const { afterEntry, beforeEntry } = pair
    const afterDoc = afterEntry.doc

    if (!beforeEntry) {
      result.added.push(
        new AddedDocumentSnapshot(
          afterDoc,
          normalize(afterEntry.data),
          toPathSegments(afterDoc),
        ),
      )
      return
    }

    const beforeDoc = beforeEntry.doc

    if (isChanged(pair)) {
      result.modified.push(
        new ModifiedDocumentSnapshot(
          beforeDoc,
          afterDoc,
          normalize(beforeEntry.data),
          normalize(afterEntry.data),
          toPathSegments(afterDoc),
        ),
      )
    } else {
      result.unmodified.push(
        new UnmodifiedDocumentSnapshot(beforeDoc, toPathSegments(beforeDoc)),
      )
    }
  })

  removedEntries.forEach(({ doc, data }) => {
    result.removed.push(
      new RemovedDocumentSnapshot(doc, normalize(data), toPathSegments(doc)),
    )
  })

  return result
}
