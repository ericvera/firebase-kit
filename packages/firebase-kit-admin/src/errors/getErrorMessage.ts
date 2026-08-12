/**
 * Extracts the most appropriate error message from an unknown error.
 * Handles Error objects, strings, and other types safely.
 */
export const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  if (typeof error === 'object' && error !== null) {
    return `Unknown error occurred: ${JSON.stringify(error)}`
  }

  return `Unknown error occurred: ${String(error)}`
}
