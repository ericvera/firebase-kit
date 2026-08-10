import { type Mock, vi } from 'vitest'
import { FirebaseAdminErrorCode } from '../errors/constants.js'

/** Options a single `enqueue` call may carry. */
export interface TaskOptions {
  id?: string
  scheduleTime?: Date
  dispatchDeadlineSeconds?: number
}

/** One enqueued task, as the mock recorded it. */
export interface TaskRecord {
  queueName: string
  taskId: string
  data: unknown
  options: TaskOptions
  scheduledAt: Date
}

interface QueueRecord {
  name: string
  enqueueCalls: TaskRecord[]
}

/** The `enqueue` call the faked queue exposes. */
export type EnqueueTask = (
  data: unknown,
  options?: TaskOptions,
) => Promise<undefined>

/** The queue handle `taskQueue` hands back. */
export interface MockTaskQueue {
  enqueue: Mock<EnqueueTask>
}

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase-admin/functions` module, so a bare
 * `vi.mock('firebase-admin/functions')` gives tests an in-memory Cloud Tasks
 * queue instead of a real one. Task ids are tracked across enqueues, so a
 * second enqueue of the same id fails the way the real service does — which is
 * what makes the dedup path testable. `setEnqueueFailure` covers the outcomes
 * the queue itself cannot produce on demand, such as an unavailable service.
 */
export const createFirebaseAdminFunctionsMock = () => {
  const queues = new Map<string, QueueRecord>()
  const scheduledTaskIds = new Set<string>()

  // Counter rather than a timestamp or random suffix, so a test that snapshots
  // an unnamed task's record gets the same id on every run.
  let generatedTaskCount = 0

  // When set, every enqueue rejects with it instead of recording. Lets a caller
  // test its handling of failures the queue would otherwise never produce.
  let enqueueFailure: unknown

  const enqueueMock = vi.fn<EnqueueTask>()
  const taskQueueMock = vi.fn<(queueName: string) => MockTaskQueue>()

  const functions = {
    taskQueue: taskQueueMock,
  }

  const getFunctions = vi.fn(() => functions)

  const resetFunctionsMock = () => {
    queues.clear()
    scheduledTaskIds.clear()
    generatedTaskCount = 0
    enqueueFailure = undefined

    // Re-established on every reset because `mockReset` strips the
    // implementation along with the call history. Every outcome is built as a
    // promise rather than thrown from an `async` body, so a failure stays a
    // rejection even though nothing here is awaited.
    enqueueMock.mockImplementation((data: unknown, options?: TaskOptions) => {
      if (enqueueFailure !== undefined) {
        // An armed failure that is already an Error is rejected as-is;
        // anything else is carried as the cause of one, so the rejection is
        // an Error either way.
        return Promise.reject(
          enqueueFailure instanceof Error
            ? enqueueFailure
            : new Error('Enqueue failed', { cause: enqueueFailure }),
        )
      }

      const queueName = taskQueueMock.mock.lastCall?.[0]

      if (!queueName) {
        return Promise.reject(
          new Error('taskQueue must be called before enqueue'),
        )
      }

      if (options?.id !== undefined && scheduledTaskIds.has(options.id)) {
        const error = new Error(
          `Task with id ${options.id} already exists in queue ${queueName}`,
        )

        ;(error as { code?: string }).code =
          FirebaseAdminErrorCode.TaskAlreadyExists

        return Promise.reject(error)
      }

      const taskRecord: TaskRecord = {
        queueName,
        taskId: options?.id ?? `task-${String((generatedTaskCount += 1))}`,
        data,
        options: options ?? {},
        scheduledAt: new Date(),
      }

      queues.get(queueName)?.enqueueCalls.push(taskRecord)

      if (options?.id !== undefined) {
        scheduledTaskIds.add(options.id)
      }

      return Promise.resolve(undefined)
    })

    taskQueueMock.mockImplementation((queueName: string) => {
      if (!queues.has(queueName)) {
        queues.set(queueName, { name: queueName, enqueueCalls: [] })
      }

      return { enqueue: enqueueMock }
    })
  }

  /**
   * Every task recorded so far, across all queues and in enqueue order. What a
   * caller test asserts on instead of reading the spy's raw call arguments,
   * which do not carry the queue a task went to.
   */
  const getEnqueuedTasks = (): TaskRecord[] =>
    [...queues.values()].flatMap((queue) => queue.enqueueCalls)

  /**
   * Makes every subsequent enqueue reject with `failure`. Passing `undefined`
   * restores normal recording.
   */
  const setEnqueueFailure = (failure: unknown) => {
    enqueueFailure = failure
  }

  return {
    enqueueMock,
    getEnqueuedTasks,
    getFunctions,
    resetFunctionsMock,
    setEnqueueFailure,
    taskQueueMock,
  }
}
