import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { registerSnapshotInputs } from './internal/snapshotInputs.js'

/**
 * A ref object that can hand back a query over its whole collection. Accepted
 * alongside a bare `Query` so a suite can snapshot by naming its refs rather
 * than restating each collection's query.
 */
export interface TestableDBRef {
  testAllQuery: () => Query
}

/** Either shape `getDBSnapshot` accepts for one collection. */
export type SnapshotInput = TestableDBRef | Query

const isTestableDBRef = (input: SnapshotInput): input is TestableDBRef =>
  'testAllQuery' in input

/**
 * Reads every document behind the given refs or queries into a flat list. An
 * emulator-backed test takes one snapshot before the code under test runs,
 * then hands it to `getDBDiffSince`, which re-reads the same refs for the after
 * snapshot. A test that needs the changes object instead takes the after
 * snapshot itself and feeds the pair to `getDBChanges`.
 */
export const getDBSnapshot = async (
  inputs: SnapshotInput | SnapshotInput[],
): Promise<QueryDocumentSnapshot[]> => {
  const inputArray = Array.isArray(inputs) ? inputs : [inputs]

  const queries = inputArray.map((input) =>
    isTestableDBRef(input) ? input.testAllQuery() : input,
  )

  const results = await Promise.all(queries.map((query) => query.get()))

  const docs = results.flatMap((result) => result.docs)
  registerSnapshotInputs(docs, inputArray)

  return docs
}
