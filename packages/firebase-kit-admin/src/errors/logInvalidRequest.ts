import { logger } from 'firebase-functions'

/**
 * Warning to be used when a request is made to an http function with an
 * invalid request (no need to alert on this, but we want to log it).
 */
export const logInvalidRequest = () => {
  logger.warn('Invalid request, unable to process.')
}
