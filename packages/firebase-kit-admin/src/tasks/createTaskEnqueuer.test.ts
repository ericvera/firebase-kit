import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  getEnqueuedTasks,
  resetFunctionsMock,
  setEnqueueFailure,
  taskQueueMock,
} from '../__mocks__/firebase-admin/functions/index.js'
import { FirebaseAdminErrorCode } from '../errors/constants.js'
import { createTaskEnqueuer } from './createTaskEnqueuer.js'

vi.mock('firebase-admin/functions')
vi.mock('firebase-functions')

const createOptions = () => ({
  queueName: 'general',
  taskId: 'cleanup-entry-1',
  data: { action: 'expire-entry', entryId: 'entry-1' },
  delayMs: 60_000,
  dispatchDeadlineSeconds: 300,
  taskName: 'cleanup',
  logContext: { entryId: 'entry-1' },
})

// Only the first case installs fake timers, and the `unit` vitest project has
// no setup file to undo that — the emulator project's harness is what resets
// them on that side.
beforeEach(() => {
  resetFunctionsMock()
})

afterEach(() => {
  vi.useRealTimers()
})

it('enqueues the task with its id, schedule time and deadline', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-24T12:00:00Z'))

  const enqueueTask = createTaskEnqueuer({ inEmulator: () => false })

  await enqueueTask(createOptions())

  // Verify: the payload reaches the named queue, the id is what Cloud Tasks
  // dedupes on, and the schedule time is the bound delay ahead of now.
  // `scheduledAt` is the mock's own receipt timestamp, not the enqueuer's, so
  // it is dropped rather than pinned.
  expect(getEnqueuedTasks().map(({ scheduledAt, ...task }) => task))
    .toMatchInlineSnapshot(`
    [
      {
        "data": {
          "action": "expire-entry",
          "entryId": "entry-1",
        },
        "options": {
          "dispatchDeadlineSeconds": 300,
          "id": "cleanup-entry-1",
          "scheduleTime": 2026-01-24T12:01:00.000Z,
        },
        "queueName": "general",
        "taskId": "cleanup-entry-1",
      },
    ]
  `)
})

it('enqueues nothing in the emulator', async () => {
  const enqueueTask = createTaskEnqueuer({ inEmulator: () => true })

  await enqueueTask(createOptions())

  // Verify: the Cloud Tasks emulator ignores scheduleTime and fires
  // immediately, so a delayed task would run the moment it is queued — the
  // queue is never even opened
  expect(taskQueueMock).not.toHaveBeenCalled()
  expect(getEnqueuedTasks()).toEqual([])
})

it('swallows an enqueue for a task id already scheduled', async () => {
  const enqueueTask = createTaskEnqueuer({ inEmulator: () => false })

  await enqueueTask(createOptions())

  // Verify: the queue refuses the second enqueue exactly as the real service
  // does, and the enqueuer absorbs it — which is what makes a repeated call
  // safe. Only the first task is recorded.
  await expect(enqueueTask(createOptions())).resolves.toBeUndefined()
  expect(getEnqueuedTasks()).toHaveLength(1)
})

it('propagates any other enqueue failure', async () => {
  setEnqueueFailure(
    Object.assign(new Error('queue unavailable'), { code: 'unavailable' }),
  )

  const enqueueTask = createTaskEnqueuer({ inEmulator: () => false })

  // Verify: only the already-exists code is absorbed; a real dispatch failure
  // has to reach the caller so the work is not silently dropped
  await expect(
    enqueueTask(createOptions()),
  ).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: queue unavailable]`)
})

it('absorbs the already-exists code however the queue raises it', async () => {
  setEnqueueFailure(
    Object.assign(new Error('Task already exists'), {
      code: FirebaseAdminErrorCode.TaskAlreadyExists,
    }),
  )

  const enqueueTask = createTaskEnqueuer({ inEmulator: () => false })

  // Verify: the branch keys on the error code rather than on the message, so a
  // reworded service error still reads as a duplicate
  await expect(enqueueTask(createOptions())).resolves.toBeUndefined()
})

it('reads the emulator flag per call rather than at bind time', async () => {
  let inEmulator = true
  const enqueueTask = createTaskEnqueuer({ inEmulator: () => inEmulator })

  await enqueueTask(createOptions())

  inEmulator = false

  await enqueueTask(createOptions())

  // Verify: the bind runs at module load, long before a test can intercept the
  // app's detection — only a call-time dereference sees the change
  expect(getEnqueuedTasks()).toHaveLength(1)
})
