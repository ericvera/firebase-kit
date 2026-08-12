import type { ObjectValidator } from 'betterbe'
import { ValidationError } from 'betterbe'
import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsInvalidArgumentError } from '../../errors/index.js'
import { assertNever } from '../../internal/assertNever.js'

/**
 * Validates the provided schema without trimming string values.
 * Use this when whitespace is significant (e.g., search operations).
 */
export const validateSchema = <T>(
  schema: ObjectValidator<T>,
  auth: AuthData | undefined,
  data: unknown,
): Promise<T> => {
  try {
    schema.validate(data)
  } catch (error) {
    let message =
      error instanceof Error
        ? error.message
        : 'Unexpectedly error is not of type Error'

    // Create a more specific message for ValidationError
    if (error instanceof ValidationError) {
      const code = error.constraint.code
      const pathRef = error.pathString ? `'${error.pathString}'` : ''

      const subject =
        error.context === 'key'
          ? pathRef
            ? `Key ${pathRef}`
            : 'Key'
          : pathRef
            ? `Value of ${pathRef}`
            : 'Value'

      switch (code) {
        case 'required':
          message = pathRef
            ? `Missing required field ${pathRef}.`
            : 'Missing required field at root.'
          break
        case 'one-of':
          message = `${subject} is not one of the allowed values: ${error.constraint.oneOf.map((v) => `'${v}'`).join(', ')}.`
          break
        case 'type':
          message = `${subject} is not the expected type (expected type: '${error.constraint.expected}').`
          break
        case 'minLength':
          message = `${subject} is too short (minimum length: ${String(error.constraint.minLength)}).`
          break
        case 'maxLength':
          message = `${subject} is too long (maximum length: ${String(error.constraint.maxLength)}).`
          break
        case 'pattern':
          message = `${subject} does not match the expected pattern: '${error.constraint.pattern}'.`
          break
        case 'alphabet':
          message = `${subject} contains invalid characters (allowed characters: '${error.constraint.alphabet}').`
          break
        case 'min':
          message = `${subject} is too low (minimum value: ${String(error.constraint.min)}).`
          break
        case 'max':
          message = `${subject} is too high (maximum value: ${String(error.constraint.max)}).`
          break
        case 'int':
          message = `${subject} is not an integer.`
          break
        case 'unique':
          message = `${subject} is not unique.`
          break
        case 'test':
          message = `${subject} failed custom validation (error: '${error.message}').`
          break
        case 'unknown-keys': {
          const pathStr =
            error.path.length > 0
              ? `in path '${error.path.join('.')}'`
              : 'at root'
          message = `Unexpected unknown key '${String(error.key)}' ${pathStr}.`
          break
        }
        default:
          assertNever(code)
          break
      }
    }

    // Rejected rather than thrown so the failure stays asynchronous, which is
    // what it was when this function carried the `async` keyword.
    return Promise.reject(new FunctionsInvalidArgumentError(auth, message))
  }

  return Promise.resolve(data as T)
}
