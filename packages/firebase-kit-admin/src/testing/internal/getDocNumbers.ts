import { compareCodeUnits } from './compareCodeUnits.js'

/** What `getDocNumbers` needs to know about one document. */
export interface NumberedDoc {
  /** Full Firestore path, e.g. `spaces/space-1/entries/entry-1`. */
  path: string
  /** Whether the document was in the snapshot taken before the test ran. */
  existedBefore: boolean
  /** The masked, normalized data the document is ranked by. */
  content: unknown
}

// Keys are sorted so two documents holding the same data serialize alike
// whatever order their fields were written in.
const serialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(serialize).join(',')}]`
  }

  if (typeof value === 'object' && value !== null) {
    const map = value as Record<string, unknown>
    const fields = Object.keys(map)
      .sort(compareCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${serialize(map[key])}`)

    return `{${fields.join(',')}}`
  }

  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

// Documents that existed before the test sort first, so nothing the code under
// test adds can renumber them.
const toRankKey = ({ existedBefore, content }: NumberedDoc): string =>
  `${existedBefore ? '0' : '1'} ${serialize(content)}`

/**
 * Numbers every document among its siblings, the documents sharing its
 * collection, starting at 1. The diff prints the number where a document id
 * would tell siblings apart, because an id is not stable across runs.
 *
 * Siblings are ranked by content, so a number only moves when an edit makes
 * one sibling sort past another. Siblings with identical content share a
 * number, because nothing stable tells them apart.
 */
export const getDocNumbers = (
  docs: readonly NumberedDoc[],
): Map<string, number> => {
  const numbers = new Map<string, number>()
  const siblingGroups = Map.groupBy(docs, ({ path }) =>
    path.slice(0, path.lastIndexOf('/')),
  )

  for (const siblings of siblingGroups.values()) {
    const ranked = siblings
      .map((doc) => ({ path: doc.path, rankKey: toRankKey(doc) }))
      .sort((a, b) => compareCodeUnits(a.rankKey, b.rankKey))

    let number = 0
    let previousRankKey: string | undefined

    for (const { path, rankKey } of ranked) {
      if (rankKey !== previousRankKey) {
        number += 1
      }

      numbers.set(path, number)
      previousRankKey = rankKey
    }
  }

  return numbers
}
