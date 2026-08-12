import { expect, it } from 'vitest'
import { InvalidTimestampError } from './InvalidTimestampError.js'

it('carries a name a host can branch on', () => {
  const error = new InvalidTimestampError()

  // Verify: identifiable both by class and by name, so a host error page can
  // classify it without importing the class
  expect({
    name: error.name,
    message: error.message,
    isError: error instanceof Error,
  }).toMatchInlineSnapshot(`
      {
        "isError": true,
        "message": "invalid timestamp received",
        "name": "InvalidTimestampError",
      }
    `)
})
