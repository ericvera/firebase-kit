import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import type { SnapshotInput } from '../getDBSnapshot.js'

// A WeakMap keeps the record off the array itself, so iteration, spread, JSON
// and equality checks never see it, and it is collected with the array.
const inputsBySnapshot = new WeakMap<QueryDocumentSnapshot[], SnapshotInput[]>()

export const registerSnapshotInputs = (
  docs: QueryDocumentSnapshot[],
  inputs: SnapshotInput[],
): void => {
  inputsBySnapshot.set(docs, inputs)
}

export const getSnapshotInputs = (
  docs: QueryDocumentSnapshot[],
): SnapshotInput[] | undefined => inputsBySnapshot.get(docs)
