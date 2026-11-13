import { isDeepStrictEqual } from 'node:util'
import { getTypeToken, maskProps } from './maskProps.js'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Masks both sides of a modified document in place. A masked field whose value
 * changed gets `(before)` / `(after)` tokens so the diff still shows it; the
 * label tracks only whether it changed, never the value, so output stays stable
 * for randomly generated values. A key on one side only keeps the plain token,
 * since the diff already prints it as `+` or `-`.
 */
export const maskModifiedProps = (
  before: unknown,
  after: unknown,
  collection: string,
  maskKeys: Record<string, string[]>,
): void => {
  if (!isPlainObject(before) || !isPlainObject(after)) {
    maskProps(before, collection, maskKeys)
    maskProps(after, collection, maskKeys)
    return
  }

  for (const key of maskKeys[collection] ?? []) {
    const beforeValue = before[key]
    const afterValue = after[key]

    if (
      beforeValue !== undefined &&
      afterValue !== undefined &&
      !isDeepStrictEqual(beforeValue, afterValue)
    ) {
      before[key] = getTypeToken(beforeValue, 'before')
      after[key] = getTypeToken(afterValue, 'after')
      continue
    }

    if (beforeValue !== undefined) {
      before[key] = getTypeToken(beforeValue)
    }

    if (afterValue !== undefined) {
      after[key] = getTypeToken(afterValue)
    }
  }
}
