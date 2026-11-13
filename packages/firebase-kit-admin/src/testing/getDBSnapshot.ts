import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'

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

/** What `getDBSnapshot` returns. */
export interface DBSnapshot {
  /** Every document read, flattened across the inputs in order. */
  docs: QueryDocumentSnapshot[]
  /** The inputs the documents were read from, always as an array. */
  refs: SnapshotInput[]
}

const isTestableDBRef = (input: SnapshotInput): input is TestableDBRef =>
  'testAllQuery' in input

/**
 * Reads every document behind the given refs or queries into a flat list and
 * returns it together with the inputs it came from. An emulator-backed test
 * takes one snapshot before the code under test runs, then hands it to
 * `getDBChangesDiff` or `expectNoDBChanges`, which re-read its `refs` for the
 * after snapshot.
 */
export const getDBSnapshot = async (
  inputs: SnapshotInput | SnapshotInput[],
): Promise<DBSnapshot> => {
  const inputArray = Array.isArray(inputs) ? inputs : [inputs]

  const queries = inputArray.map((input) =>
    isTestableDBRef(input) ? input.testAllQuery() : input,
  )

  const results = await Promise.all(queries.map((query) => query.get()))

  const docs = results.flatMap((result) => result.docs)

  return { docs, refs: inputArray }
}
