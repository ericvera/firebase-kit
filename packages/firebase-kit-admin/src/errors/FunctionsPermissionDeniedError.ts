import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsError } from './FunctionsError.js'

export class FunctionsPermissionDeniedError extends FunctionsError {
  public constructor(auth: AuthData | undefined, message: string) {
    // 'Error' breaks prototype chain here
    super('permission-denied', auth, message, true)

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
