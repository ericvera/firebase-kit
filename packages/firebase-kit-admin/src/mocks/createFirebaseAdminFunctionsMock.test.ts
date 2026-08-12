import { expect, it } from 'vitest'
import { FirebaseAdminErrorCode } from '../errors/constants.js'
import { getErrorCode } from '../errors/getErrorCode.js'
import { createFirebaseAdminFunctionsMock } from './createFirebaseAdminFunctionsMock.js'

/** The queue handle `taskQueue` hands back. */
interface MockTaskQueue {
  enqueue: (data: unknown, options?: { id?: string }) => Promise<undefined>
}

it('records an enqueue against the queue it was opened on', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()

  await mock.getFunctions().taskQueue('general').enqueue({ entryId: '1' }, {})

  // Verify: the payload reaches the queue, which is what a caller test asserts
  // on instead of standing up Cloud Tasks
  expect(mock.enqueueMock).toHaveBeenCalledTimes(1)
  expect(mock.taskQueueMock).toHaveBeenCalledWith('general')
})

it('rejects a second enqueue of the same task id', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()

  // The queue's `enqueue` is a deliberately untyped `vi.fn()`, so what it
  // resolves with is named here rather than in the published mock.
  const queue: MockTaskQueue = mock.getFunctions().taskQueue('general')

  await queue.enqueue({ entryId: '1' }, { id: 'cleanup-1' })

  const duplicate = queue.enqueue({ entryId: '1' }, { id: 'cleanup-1' })

  // Verify: the dedup path a caller relies on is reproduced, error code
  // included — without it the already-exists branch could never be exercised
  await expect(duplicate).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Task with id cleanup-1 already exists in queue general]`,
  )
  await expect(
    duplicate.catch((error: unknown) => getErrorCode(error)),
  ).resolves.toEqual(FirebaseAdminErrorCode.TaskAlreadyExists)
})

it('allows the same id again after a reset', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()

  const first = mock.getFunctions().taskQueue('general')

  await first.enqueue({ entryId: '1' }, { id: 'cleanup-1' })

  mock.resetFunctionsMock()

  const second = mock.getFunctions().taskQueue('general')

  // Verify: scheduled ids are per-test state, so one test's task cannot make
  // the next one's enqueue look like a duplicate
  await expect(
    second.enqueue({ entryId: '1' }, { id: 'cleanup-1' }),
  ).resolves.toBeUndefined()
})

it('refuses an enqueue before a queue has been opened', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()

  // Verify: calling enqueue without taskQueue is a test-authoring mistake, and
  // fails loudly rather than recording against an unnamed queue
  await expect(
    mock.enqueueMock({ entryId: '1' }, {}),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: taskQueue must be called before enqueue]`,
  )
})

it('reports every recorded task across queues in enqueue order', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()

  await mock.getFunctions().taskQueue('general').enqueue({ step: 1 }, {})
  await mock.getFunctions().taskQueue('slow').enqueue({ step: 2 }, {})

  // Verify: the raw spy's arguments do not carry which queue a task went to, so
  // the reader pairs each payload with its queue
  expect(
    mock.getEnqueuedTasks().map(({ queueName, data }) => ({ queueName, data })),
  ).toMatchInlineSnapshot(`
    [
      {
        "data": {
          "step": 1,
        },
        "queueName": "general",
      },
      {
        "data": {
          "step": 2,
        },
        "queueName": "slow",
      },
    ]
  `)
})

it('generates a stable id for a task enqueued without one', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()

  await mock.getFunctions().taskQueue('general').enqueue({ step: 1 }, {})
  await mock.getFunctions().taskQueue('general').enqueue({ step: 2 }, {})

  // Verify: a counter rather than a timestamp or random suffix, so a test that
  // snapshots an unnamed task's record gets the same id on every run
  expect(mock.getEnqueuedTasks().map((task) => task.taskId)).toEqual([
    'task-1',
    'task-2',
  ])
})

it('fails every enqueue while a failure is set', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()
  mock.setEnqueueFailure(new Error('queue unavailable'))

  const queue = mock.getFunctions().taskQueue('general')

  // Verify: covers the outcomes the queue cannot produce on demand, so a
  // caller's dispatch-failure branch is reachable
  await expect(
    queue.enqueue({ step: 1 }, {}),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: queue unavailable]`)
  expect(mock.getEnqueuedTasks()).toEqual([])
})

it('records again once the failure is cleared', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()
  mock.setEnqueueFailure(new Error('queue unavailable'))
  mock.setEnqueueFailure(undefined)

  await mock.getFunctions().taskQueue('general').enqueue({ step: 1 }, {})

  // Verify: the failure is a mode, not a one-shot — clearing it restores normal
  // recording within the same test
  expect(mock.getEnqueuedTasks()).toHaveLength(1)
})

it('clears an injected failure on reset', async () => {
  const mock = createFirebaseAdminFunctionsMock()

  mock.resetFunctionsMock()
  mock.setEnqueueFailure(new Error('queue unavailable'))

  mock.resetFunctionsMock()

  await mock.getFunctions().taskQueue('general').enqueue({ step: 1 }, {})

  // Verify: one test's injected failure cannot leak into the next
  expect(mock.getEnqueuedTasks()).toHaveLength(1)
})
