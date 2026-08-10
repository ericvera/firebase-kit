import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsError } from './FunctionsError.js'

export class FunctionsInternalError extends FunctionsError {
  public constructor(
    auth: AuthData | undefined,
    message: string,
    details?: Record<string, unknown>,
  ) {
    // 'Error' breaks prototype chain here
    super('internal', auth, message, true, details)

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
