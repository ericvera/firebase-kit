import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsError } from './FunctionsError.js'

export class FunctionsFailedPreconditionError extends FunctionsError {
  public constructor(
    auth: AuthData | undefined,
    message: string,
    details?: Record<string, unknown>,
  ) {
    // 'Error' breaks prototype chain here
    super('failed-precondition', auth, message, false, details)

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
