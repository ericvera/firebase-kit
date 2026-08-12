interface ErrorWithCode {
  error: Error
  code: string
  details: Record<string, unknown> | undefined
}

interface NoErrorFound {
  error: undefined
  code: undefined
  details: undefined
}

const NoErrorFound: NoErrorFound = {
  error: undefined,
  code: undefined,
  details: undefined,
}

/**
 * Unwraps whatever a callable, an SDK or a Vue error handler threw down to the
 * first `code` string it carries, walking the `cause` chain because Firebase
 * wraps its errors. Produces the offending error, its code and any `details`
 * payload, or an all-undefined result when nothing in the chain has a code.
 */
export const getErrorWithCode = (
  error: unknown,
): ErrorWithCode | NoErrorFound => {
  if (typeof error !== 'object' || error === null) {
    return NoErrorFound
  }

  if ('code' in error && typeof error.code === 'string') {
    const details =
      'details' in error &&
      typeof error.details === 'object' &&
      error.details !== null
        ? (error.details as Record<string, unknown>)
        : undefined
    return { error: error as unknown as Error, code: error.code, details }
  }

  if ('cause' in error) {
    return getErrorWithCode(error.cause)
  }

  return NoErrorFound
}
