/** Host-app collaborators a task enqueuer is bound to. */
export interface TaskEnqueuerDependencies {
  /**
   * Whether this process is running against an emulator. Passed in rather than
   * detected here so the app owns the decision, and so an app's tests can
   * intercept it through their own module.
   */
  inEmulator: () => boolean
}

/** One enqueue, described end to end. */
export interface EnqueueTaskOptions<TData extends { action: string }> {
  /** Queue the task is dispatched to. */
  queueName: string
  /**
   * Task id. Cloud Tasks rejects a second task with the same id for roughly an
   * hour after the first, which is what makes a repeated enqueue safe.
   */
  taskId: string
  /**
   * Payload the queue's handler receives. Its `action` labels the enqueuer's
   * log lines.
   */
  data: TData
  /** How far ahead of now the task should fire. */
  delayMs: number
  /** How long a dispatch may run before Cloud Tasks gives up on it. */
  dispatchDeadlineSeconds: number
  /** Identifiers attached to those log lines so a skip can be traced. */
  logContext: Record<string, unknown>
}
