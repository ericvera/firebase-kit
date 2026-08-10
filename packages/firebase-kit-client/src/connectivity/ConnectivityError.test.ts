import { expect, it } from 'vitest'
import { ConnectivityError } from './ConnectivityError.js'
import { ConnectionStatus } from './constants.js'

it('constructs with correct properties and default message', () => {
  const error = new ConnectivityError(ConnectionStatus.Offline)

  expect(error).toMatchInlineSnapshot(
    `[ConnectivityError: Connectivity issue: offline]`,
  )
  expect(error.status).toMatchInlineSnapshot(`"offline"`)
  expect(error.name).toMatchInlineSnapshot(`"ConnectivityError"`)
})

it('constructs with custom message', () => {
  const error = new ConnectivityError(
    ConnectionStatus.ServicesUnavailable,
    'Custom outage message',
  )

  expect(error).toMatchInlineSnapshot(
    `[ConnectivityError: Custom outage message]`,
  )
  expect(error.status).toMatchInlineSnapshot(`"services-unavailable"`)
  expect(error.name).toMatchInlineSnapshot(`"ConnectivityError"`)
})

it('maintains correct prototype chain', () => {
  const error = new ConnectivityError(ConnectionStatus.Offline)

  expect(error instanceof ConnectivityError).toMatchInlineSnapshot(`true`)
  expect(error instanceof Error).toMatchInlineSnapshot(`true`)
})
