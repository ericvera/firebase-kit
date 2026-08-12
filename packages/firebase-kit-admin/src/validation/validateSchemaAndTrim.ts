import type { ObjectValidator } from 'betterbe'
import type { AuthData } from 'firebase-functions/tasks'
import { validateSchema } from './internal/validateSchema.js'

const trimAllStrings = (data: unknown): unknown => {
  if (typeof data === 'string') {
    return data.trim()
  }

  if (Array.isArray(data)) {
    return data.map(trimAllStrings)
  }

  if (typeof data === 'object' && data !== null) {
    const result: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(data)) {
      result[key] = trimAllStrings(value)
    }

    return result
  }

  return data
}

/**
 * Validates the provided schema and trims all string values.
 * NOTE: It may be desirable at some point to add a flag to disable trimming in
 * case the schema requires leading or trailing whitespace.
 */
export const validateSchemaAndTrim = async <T>(
  schema: ObjectValidator<T>,
  auth: AuthData | undefined,
  data: unknown,
): Promise<T> => {
  const validatedData = await validateSchema(schema, auth, data)
  return trimAllStrings(validatedData) as T
}
