import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'
import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsInternalError } from '../errors/index.js'
import type { TransactionReader } from './internal/TransactionReader.js'

/**
 * Checks that a document exists and returns its data, throwing if not found
 */
export const checkDocumentExists = async <
  T extends { id: string } & DBT,
  DBT extends DocumentData,
>(
  ref: DocumentReference<DBT, DBT>,
  auth: AuthData | undefined,
  reader?: TransactionReader,
): Promise<T> => {
  const doc = reader ? await reader.get(ref) : await ref.get()

  const data = doc.data()

  if (!data) {
    // Extract collection name from the reference path
    const collectionName = ref.parent.id

    throw new FunctionsInternalError(
      auth,
      `${collectionName} not found: ${ref.id}`,
    )
  }

  return {
    id: ref.id,
    ...data,
  } as T
}
