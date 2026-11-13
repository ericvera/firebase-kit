import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { getDBChanges } from './getDBChanges.js'
import { getDBChangesDiff } from './getDBChangesDiff.js'
import { getDBSnapshot } from './getDBSnapshot.js'
import { getSnapshotInputs } from './internal/snapshotInputs.js'

/**
 * Takes the after snapshot from the same refs `before` was read from and
 * returns the printable DB DIFF string. An emulator test takes `before` with
 * `getDBSnapshot`, runs the code under test, then pins this call's result.
 *
 * `before` must be the array `getDBSnapshot` returned; a copy does not carry
 * its refs and makes this throw. `masks` behaves as in `getDBChanges`.
 */
export const getDBDiffSince = async <TCollection extends string = string>(
  before: QueryDocumentSnapshot[],
  masks?: Partial<Record<TCollection, string[]>>,
): Promise<string> => {
  const inputs = getSnapshotInputs(before)

  if (!inputs) {
    throw new Error(
      'getDBDiffSince needs the array getDBSnapshot returned; a copy made with slice, spread or filter does not carry the refs it was taken from',
    )
  }

  const after = await getDBSnapshot(inputs)

  return getDBChangesDiff(getDBChanges(before, after, masks))
}
