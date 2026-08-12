import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { getDBSnapshot as utilGetDBSnapshot } from 'firestore-snapshot-utils'

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
 * emulator-backed test takes one snapshot before the code under test runs and
 * one after, then feeds the pair to `getDBChanges`.
 */
export const getDBSnapshot = async (
  inputs: SnapshotInput | SnapshotInput[],
): Promise<QueryDocumentSnapshot[]> => {
  const inputArray = Array.isArray(inputs) ? inputs : [inputs]

  const queries = inputArray.map((input) =>
    isTestableDBRef(input) ? input.testAllQuery() : input,
  )

  return utilGetDBSnapshot(queries)
}
