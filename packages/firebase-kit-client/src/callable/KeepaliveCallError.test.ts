import { expect, it } from 'vitest'
import { KeepaliveCallError } from './KeepaliveCallError.js'

it('is both an Error and a KeepaliveCallError', () => {
  const error = new KeepaliveCallError('Keepalive request failed')

  // Verify: instanceof Error and instanceof KeepaliveCallError
  expect(error).toBeInstanceOf(Error)
  expect(error).toBeInstanceOf(KeepaliveCallError)
  expect(error.name).toBe('KeepaliveCallError')
  expect(error.message).toBe('Keepalive request failed')
})

it('carries a cause through the error options', () => {
  const cause = new Error('socket closed')
  const error = new KeepaliveCallError('Keepalive request failed', { cause })

  // Verify: code, status and details undefined for a local failure, cause
  // preserved
  expect(error.cause).toBe(cause)
  expect(error.code).toBeUndefined()
  expect(error.status).toBeUndefined()
  expect(error.details).toBeUndefined()
})

it('exposes the code, status and details it was constructed with', () => {
  const details = { minVersion: 5 }
  const error = new KeepaliveCallError('API version missing.', {
    code: 'functions/failed-precondition',
    status: 500,
    details,
  })

  // Verify: code, status and details as constructed, details unwrapped
  expect(error.code).toBe('functions/failed-precondition')
  expect(error.status).toBe(500)
  expect(error.details).toBe(details)
})
