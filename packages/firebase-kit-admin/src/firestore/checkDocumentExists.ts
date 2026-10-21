import type { DocumentData, DocumentReference } from 'firebase-admin/firestore'
import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsInternalError } from '../errors/index.js'
import type { TransactionReader } from './internal/TransactionReader.js'

interface CheckDocumentExistsOptions {
  details?: Record<string, unknown>
}

/**
 * Checks that a document exists and returns its data, throwing if not found.
 * `options.details` is forwarded to the thrown error, so it reaches the logs
 * and the callable's client.
 */
export const checkDocumentExists = async <
  T extends { id: string } & DBT,
  DBT extends DocumentData,
>(
  ref: DocumentReference<DBT, DBT>,
  auth: AuthData | undefined,
  reader?: TransactionReader,
  options?: CheckDocumentExistsOptions,
): Promise<T> => {
  const doc = reader ? await reader.get(ref) : await ref.get()

  const data = doc.data()

  if (!data) {
    // Extract collection name from the reference path
    const collectionName = ref.parent.id

    throw new FunctionsInternalError(
      auth,
      `${collectionName} not found: ${ref.id}`,
      options?.details,
    )
  }

  return {
    id: ref.id,
    ...data,
  } as T
}
