/**
 * Builds the error object the client throws for a fatal failure. Injected so
 * the package never reaches for a framework-provided global — an app whose
 * framework supplies an error factory passes that one through, and an app
 * without one supplies its own.
 */
export type CreateErrorFunction = (options: {
  message: string
  cause?: unknown
  fatal?: boolean
}) => Error
