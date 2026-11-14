export const isMap = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const prototype: unknown = Object.getPrototypeOf(value)

  return prototype === Object.prototype || prototype === null
}

export const readPath = (
  data: Record<string, unknown>,
  path: string,
): unknown => {
  const [first = '', ...rest] = path.split('.')
  let value = data[first]

  for (const segment of rest) {
    if (!isMap(value)) {
      return undefined
    }

    value = value[segment]
  }

  return value
}

// Intermediates are copied because the top-level copy in `getDBChanges` is
// shallow and `data()` may return the caller's objects. Callers write only
// after `readPath` returned a defined value, so every intermediate is a map.
export const writePath = (
  data: Record<string, unknown>,
  path: string,
  value: unknown,
): void => {
  const segments = path.split('.')
  const leaf = segments.pop() ?? ''
  let parent = data

  for (const segment of segments) {
    const copy = { ...(parent[segment] as Record<string, unknown>) }

    parent[segment] = copy
    parent = copy
  }

  parent[leaf] = value
}
