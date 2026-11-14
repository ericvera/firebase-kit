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
