import type { Request as TaskRequest } from 'firebase-functions/tasks'

/**
 * Builds the request a handler test feeds to a task handler directly, without
 * going through the deployed queue function. Needs no application
 * configuration — a task carries no version envelope — so it is imported
 * straight from this package rather than bound like `createRequestBuilders`.
 */
export const createTaskRequest = <T>(data: T): TaskRequest<T> => ({
  data,
  queueName: 'test-queue',
  id: 'test-task-id',
  retryCount: 0,
  executionCount: 1,
  scheduledTime: new Date().toISOString(),
})
