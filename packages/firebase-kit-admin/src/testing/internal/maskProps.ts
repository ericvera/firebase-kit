const getTypeToken = (value: unknown): string => {
  if (value === null) {
    return '/Null/'
  }

  if (Array.isArray(value)) {
    return '/Array/'
  }

  switch (typeof value) {
    case 'string':
      return '/String/'
    case 'number':
      return '/Number/'
    case 'boolean':
      return '/Boolean/'
    default:
      return '/Map/'
  }
}

// NOTE: Currently only works with props that exist in the top level of the
// object
export const maskProps = <T>(
  a: T,
  collection: string,
  maskKeys: Record<string, string[]>,
): T => {
  if (typeof a !== 'object' || Array.isArray(a) || a === null) {
    return a
  }

  const keys = maskKeys[collection]

  if (keys) {
    const obj = a as Record<string, unknown>

    for (const key of keys) {
      const value = obj[key]

      if (value === undefined) {
        continue
      }

      obj[key] = getTypeToken(value)
    }
  }

  return a
}
