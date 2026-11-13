import type { DBSnapshot } from './getDBSnapshot.js'
import { getDBSnapshot } from './getDBSnapshot.js'
import { formatDBChanges } from './internal/formatDBChanges.js'
import { getDBChanges } from './internal/getDBChanges.js'

/**
 * Re-reads the refs `before` carries and returns the printable DB DIFF string
 * of every document added, removed or modified since. An emulator test takes
 * `before` with `getDBSnapshot`, runs the code under test, then pins this
 * call's result with an inline snapshot.
 *
 * `masks` drops per-collection fields whose values are not stable enough to
 * assert on. The type parameter lets an app key it by its own collection enum,
 * so a typo in a collection name fails to compile.
 */
export const getDBChangesDiff = async <TCollection extends string = string>(
  before: DBSnapshot,
  masks?: Partial<Record<TCollection, string[]>>,
): Promise<string> => {
  const after = await getDBSnapshot(before.refs)

  return formatDBChanges(getDBChanges(before, after, masks))
}
