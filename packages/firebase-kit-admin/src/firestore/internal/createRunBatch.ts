import type { Firestore, WriteBatch } from 'firebase-admin/firestore'

/**
 * Binds a `getFirestore` to a batch-write helper.
 *
 * The returned function automatically creates a batch, passes it to the
 * callback, and commits it, eliminating boilerplate for simple write-only
 * operations.
 *
 * Use it for pure writes with no conditional logic based on current state. For
 * read-then-write operations, use runTransaction instead.
 */
export const createRunBatch =
  (getFirestore: () => Firestore) =>
  async <T = void>(
    callback: (batch: WriteBatch) => T | Promise<T>,
  ): Promise<T> => {
    const batch = getFirestore().batch()
    const result = await callback(batch)

    await batch.commit()

    return result
  }
