import type { DocumentData, Query } from 'firebase-admin/firestore'
import type { TransactionReader } from './internal/TransactionReader.js'

/**
 * Returns every document the query matches as `{ id, ...data }`, or `[]` when
 * it matches none. Reads through `reader` when one is given, so the read joins
 * that transaction.
 */
export const getDocumentsFromQuery = async <
  T extends DBT & { id: string },
  DBT extends DocumentData,
>(
  query: Query<DBT, DBT>,
  reader?: TransactionReader,
): Promise<T[]> => {
  const snapshot = reader ? await reader.get(query) : await query.get()

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as T)
}
