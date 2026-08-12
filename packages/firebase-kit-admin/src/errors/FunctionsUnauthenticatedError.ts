import { FunctionsError } from './FunctionsError.js'

export class FunctionsUnauthenticatedError extends FunctionsError {
  public constructor() {
    // 'Error' breaks prototype chain here
    super('unauthenticated', undefined, 'User not authenticated.', false)

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
