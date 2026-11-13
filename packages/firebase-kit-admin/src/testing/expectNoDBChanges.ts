import type { DBSnapshot } from './getDBSnapshot.js'
import { getDBSnapshot } from './getDBSnapshot.js'
import { formatDBChanges } from './internal/formatDBChanges.js'
import { getDBChanges } from './internal/getDBChanges.js'

/**
 * Asserts the code under test left the documents behind `before`'s refs
 * untouched. A failure prints the same DB DIFF text `getDBChangesDiff` would.
 *
 * It takes no masks. A rewrite with identical data still counts as a change,
 * because the document's `updateTime` moved.
 */
export const expectNoDBChanges = async (before: DBSnapshot): Promise<void> => {
  const after = await getDBSnapshot(before.refs)
  const changes = getDBChanges(before, after)

  if (
    changes.added.length === 0 &&
    changes.removed.length === 0 &&
    changes.modified.length === 0
  ) {
    return
  }

  throw new Error(
    `Expected no DB changes, found:\n\n${formatDBChanges(changes)}`,
  )
}
