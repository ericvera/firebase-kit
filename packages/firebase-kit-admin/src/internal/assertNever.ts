/**
 * Ensures exhaustive switch/if-else handling at compile time.
 * If all cases are handled, TypeScript accepts the never parameter.
 * If a case is missing, TypeScript produces a compile error.
 */
export const assertNever = (value: never): void => {
  // Reaching this line at runtime means a case was missed. There is nothing
  // useful to do with the value, so it is discarded rather than left unread.
  void value
}
