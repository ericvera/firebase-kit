import type { DocumentData, UpdateData } from 'firebase-admin/firestore'
import type { DBSnapshot } from './getDBSnapshot.js'
import { getDBSnapshot } from './getDBSnapshot.js'
import { formatDBChanges } from './internal/formatDBChanges.js'
import { getDBChanges } from './internal/getDBChanges.js'

/**
 * Per-collection field paths to mask, keyed by the collections of `TSchema`.
 * Each path is a Firestore `update()`-style field path checked with
 * `UpdateData` against that collection's document type.
 */
export type DBMasks<TSchema> = {
  [C in keyof TSchema & string]?: readonly (keyof UpdateData<TSchema[C]> &
    string)[]
}

/**
 * Re-reads the refs `before` carries and returns the printable DB DIFF string
 * of every document added, removed or modified since. An emulator test takes
 * `before` with `getDBSnapshot`, runs the code under test, then pins this
 * call's result with an inline snapshot.
 *
 * Ids are not stable across runs, so a document prints as `[ID]` and the
 * parent of a subcollection document as its number among its siblings, as in
 * `spaces/[ID 1]/entries/[ID]`. A parent is ranked by what it held before the
 * test, documents the test creates are numbered after the pre-existing ones,
 * and identical siblings share a number. Sections are sorted by path, so a
 * document sits directly above the documents in its subcollections.
 *
 * `masks` hides per-collection fields whose values are not stable enough to
 * assert on. Each entry is a Firestore `update()`-style field path, always
 * split on dots, so `'quote.fees.at'` masks one nested value. `TSchema` maps
 * each collection name to its document type, and every path is type checked
 * against it through `UpdateData`. Passing masks requires `TSchema`, while a
 * call without masks needs no type argument. A path cannot reach into array
 * elements, and a nested map typed as a named `interface` adds no dotted
 * paths, the same as with `update()`. Write nested maps as inline object
 * types instead.
 */
export const getDBChangesDiff = async <
  TSchema extends { [C in keyof TSchema]: DocumentData } = never,
>(
  before: DBSnapshot,
  masks?: NoInfer<[TSchema] extends [never] ? undefined : DBMasks<TSchema>>,
): Promise<string> => {
  const after = await getDBSnapshot(before.refs)

  return formatDBChanges(getDBChanges(before, after, masks))
}
