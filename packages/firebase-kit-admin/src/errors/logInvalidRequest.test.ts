import { logger } from 'firebase-functions'
import { expect, it, vi } from 'vitest'
import { logInvalidRequest } from './logInvalidRequest.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

it('logs an invalid request warning message to Cloud Logging', () => {
  // Call the function
  logInvalidRequest()

  // Verify that logger.warn was called with the expected message
  expect(logger.warn).toHaveBeenCalledOnce()
  expect(logger.warn).toHaveBeenCalledWith(
    'Invalid request, unable to process.',
  )
})
