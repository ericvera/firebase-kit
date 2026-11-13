import type {
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase-admin/firestore'
import type { TransactionReader } from './internal/TransactionReader.js'

/**
 * Reads many documents in one batch and returns one entry per ref, in the same
 * order: the `{ id, ...data }` entity, or `undefined` when that document does
 * not exist. Reads through `reader` when one is given, so the read joins that
 * transaction.
 */
export const getDocuments = async <
  T extends DBT & { id: string },
  DBT extends DocumentData,
>(
  refs: DocumentReference<DBT, DBT>[],
  reader?: TransactionReader,
): Promise<(T | undefined)[]> => {
  const [first] = refs

  if (!first) {
    return []
  }

  // The instance-level `getAll` drops the converter's type, and this cast is
  // what the helper exists to hide.
  const snapshots = reader
    ? await reader.getAll(...refs)
    : ((await first.firestore.getAll(...refs)) as DocumentSnapshot<DBT, DBT>[])

  return snapshots.map((snapshot) => {
    const data = snapshot.data()

    return data ? ({ id: snapshot.id, ...data } as T) : undefined
  })
}
