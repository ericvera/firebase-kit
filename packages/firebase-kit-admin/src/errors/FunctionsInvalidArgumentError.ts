import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsError } from './FunctionsError.js'

export class FunctionsInvalidArgumentError extends FunctionsError {
  public constructor(auth: AuthData | undefined, message: string) {
    // 'Error' breaks prototype chain here
    super('invalid-argument', auth, message, true)

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
