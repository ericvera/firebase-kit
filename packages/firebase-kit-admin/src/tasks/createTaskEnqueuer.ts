import { getFunctions } from 'firebase-admin/functions'
import { logger } from 'firebase-functions'
import { FirebaseAdminErrorCode } from '../errors/constants.js'
import { getErrorCode } from '../errors/getErrorCode.js'
import type { EnqueueTaskOptions, TaskEnqueuerDependencies } from './types.js'

/**
 * Binds the Cloud Tasks enqueue path to one app. Called once at module scope;
 * the enqueue function it returns is what every per-task helper wraps.
 *
 * It absorbs the two outcomes that are not failures. In the emulator it
 * enqueues nothing, because the Cloud Tasks emulator ignores `scheduleTime`
 * and fires immediately — a delayed task would run the moment it is queued. An
 * id that is already scheduled is a duplicate of work already pending, so it
 * is logged and swallowed rather than raised. Anything else throws.
 */
export const createTaskEnqueuer =
  (dependencies: TaskEnqueuerDependencies) =>
  async <TData extends object>({
    queueName,
    taskId,
    data,
    delayMs,
    dispatchDeadlineSeconds,
    taskName,
    logContext,
  }: EnqueueTaskOptions<TData>): Promise<void> => {
    if (dependencies.inEmulator()) {
      logger.info(`Skipping ${taskName} task enqueue in emulator`, logContext)

      return
    }

    const queue = getFunctions().taskQueue<TData>(queueName)

    try {
      await queue.enqueue(data, {
        id: taskId,
        scheduleTime: new Date(Date.now() + delayMs),
        dispatchDeadlineSeconds,
      })
    } catch (error) {
      if (getErrorCode(error) === FirebaseAdminErrorCode.TaskAlreadyExists) {
        logger.info(`${taskName} task already exists, skipping`, logContext)

        return
      }

      throw error
    }
  }
