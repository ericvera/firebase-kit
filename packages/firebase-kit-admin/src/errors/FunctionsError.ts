import { logger } from 'firebase-functions'
import type { FunctionsErrorCode } from 'firebase-functions/https'
import { HttpsError } from 'firebase-functions/https'
import type { AuthData } from 'firebase-functions/tasks'

export class FunctionsError extends HttpsError {
  public constructor(
    errorCode: FunctionsErrorCode,
    auth: AuthData | undefined,
    message: string,
    shouldLogError: boolean,
    details?: Record<string, unknown>,
  ) {
    // 'Error' breaks prototype chain here
    super(errorCode, message, details)

    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype)

    // Log errors so that they can trigger an alarm in the system
    if (shouldLogError) {
      let messageWithAuthInfo = `[${errorCode.toUpperCase()}] ${message}`

      if (auth === undefined) {
        messageWithAuthInfo += ' [UNAUTHENTICATED]'
      } else {
        messageWithAuthInfo += ` [UID: ${auth.uid}]`
      }

      logger.error(messageWithAuthInfo, details)
      return
    }
  }
}
