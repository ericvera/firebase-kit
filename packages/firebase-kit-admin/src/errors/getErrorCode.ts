/**
 * Extracts the error code from an unknown error.
 * Returns undefined if no code property exists.
 */
export const getErrorCode = (error: unknown): string | undefined => {
  if (error && typeof error === 'object' && 'code' in error) {
    return String(error.code)
  }

  return undefined
}
