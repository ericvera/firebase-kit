import { isDeepStrictEqual } from 'node:util'
import { isMap } from './isMap.js'
import { getTypeToken, maskProps } from './maskProps.js'
import { readPath } from './readPath.js'
import { writePath } from './writePath.js'

/**
 * Masks both sides of a modified document in place. A masked field whose value
 * changed gets `(before)` / `(after)` tokens so the diff still shows it. The
 * label tracks only whether it changed, never the value, so output stays stable
 * for randomly generated values. A path on one side only keeps the plain token,
 * since the diff already prints it as `+` or `-`.
 *
 * It runs on raw document data before normalization, so its equality check
 * sees real values and Timestamps compare by instant.
 */
export const maskModifiedProps = (
  before: unknown,
  after: unknown,
  collection: string,
  maskKeys: Partial<Record<string, readonly string[]>>,
): void => {
  if (!isMap(before) || !isMap(after)) {
    maskProps(before, collection, maskKeys)
    maskProps(after, collection, maskKeys)
    return
  }

  for (const path of maskKeys[collection] ?? []) {
    const beforeValue = readPath(before, path)
    const afterValue = readPath(after, path)

    if (
      beforeValue !== undefined &&
      afterValue !== undefined &&
      !isDeepStrictEqual(beforeValue, afterValue)
    ) {
      writePath(before, path, getTypeToken(beforeValue, 'before'))
      writePath(after, path, getTypeToken(afterValue, 'after'))
      continue
    }

    if (beforeValue !== undefined) {
      writePath(before, path, getTypeToken(beforeValue))
    }

    if (afterValue !== undefined) {
      writePath(after, path, getTypeToken(afterValue))
    }
  }
}
