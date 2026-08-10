import { expect, it } from 'vitest'
import { createTaskRequest } from './createTaskRequest.js'

it('builds a task request around the payload', () => {
  const result = createTaskRequest({ entryId: 'entry-1' })

  // Verify: the payload is untouched — a task carries no version envelope — and
  // the dispatch metadata a handler may read is filled in
  expect(result.data).toMatchInlineSnapshot(`
    {
      "entryId": "entry-1",
    }
  `)
  expect(result.queueName).toEqual('test-queue')
  expect(result.retryCount).toEqual(0)
})
