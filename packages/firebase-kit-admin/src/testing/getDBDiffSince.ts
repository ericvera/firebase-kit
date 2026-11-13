import { getDBChanges } from './getDBChanges.js'
import { getDBChangesDiff } from './getDBChangesDiff.js'
import type { DBSnapshot } from './getDBSnapshot.js'
import { getDBSnapshot } from './getDBSnapshot.js'

/**
 * Re-reads the refs `before` carries for the after snapshot and returns the
 * printable DB DIFF string. An emulator test takes `before` with
 * `getDBSnapshot`, runs the code under test, then pins this call's result.
 * `masks` behaves as in `getDBChanges`.
 */
export const getDBDiffSince = async <TCollection extends string = string>(
  before: DBSnapshot,
  masks?: Partial<Record<TCollection, string[]>>,
): Promise<string> => {
  const after = await getDBSnapshot(before.refs)

  return getDBChangesDiff(getDBChanges(before, after, masks))
}
