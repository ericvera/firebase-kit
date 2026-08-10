/**
 * Firebase error codes that callers handle explicitly rather than letting
 * them bubble up.
 */
export enum FirebaseAdminErrorCode {
  /** Task with the same ID already exists in Cloud Tasks queue */
  TaskAlreadyExists = 'functions/task-already-exists',
  /** Firestore document already exists (from create()) */
  DocumentAlreadyExists = '6',
}
