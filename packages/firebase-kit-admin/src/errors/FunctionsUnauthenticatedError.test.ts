import { logger } from 'firebase-functions'
import { expect, it, vi } from 'vitest'
import { FunctionsUnauthenticatedError } from './FunctionsUnauthenticatedError.js'

vi.mock('firebase-functions')

it('works unauthenticated', () => {
  const error = new FunctionsUnauthenticatedError()
  expect(error).toMatchInlineSnapshot(`[Error: User not authenticated.]`)
  expect(error.code).toMatchInlineSnapshot(`"unauthenticated"`)
  expect(error.details).toMatchInlineSnapshot(`undefined`)

  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})
