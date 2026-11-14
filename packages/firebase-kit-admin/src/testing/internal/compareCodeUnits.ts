/**
 * Orders two strings by UTF-16 code unit, the order a bare `Array.sort()`
 * uses. Unlike `localeCompare` it does not depend on the machine's locale, so
 * what it sorts reads the same on every machine.
 */
export const compareCodeUnits = (a: string, b: string): number => {
  if (a === b) {
    return 0
  }

  return a < b ? -1 : 1
}
