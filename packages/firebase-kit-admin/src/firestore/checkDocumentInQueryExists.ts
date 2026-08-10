import type { DocumentData, Query } from 'firebase-admin/firestore'
import type { AuthData } from 'firebase-functions/tasks'
import { FunctionsInternalError } from '../errors/index.js'
import type { TransactionReader } from './internal/TransactionReader.js'

interface CheckDocumentInQueryExistsOptions {
  auth: AuthData | undefined
  reader?: TransactionReader
  errorIfEmpty?: string
  errorIfMultiple?: string
}

type CheckDocumentInQueryExistsResult<
  T,
  TOptions extends CheckDocumentInQueryExistsOptions,
> = TOptions['errorIfEmpty'] extends string ? T : T | undefined

/**
 * Checks that a query returns at most one document and returns its data. Throws
 * if multiple documents are found (with custom or default error message).
 * Throws if errorIfEmpty is provided and no document is found. Returns
 * undefined if errorIfEmpty is not provided and no document is found.
 */
export const checkDocumentInQueryExists = async <
  T extends DBT & { id: string },
  DBT extends DocumentData,
  Options extends CheckDocumentInQueryExistsOptions =
    CheckDocumentInQueryExistsOptions,
>(
  query: Query<DBT, DBT>,
  options: Options,
): Promise<CheckDocumentInQueryExistsResult<T, Options>> => {
  const snapshot = options.reader
    ? await options.reader.get(query)
    : await query.get()

  if (snapshot.size > 1) {
    const errorMessage =
      options.errorIfMultiple ??
      `Expected at most 1 document in query, found ${String(snapshot.size)}`

    throw new FunctionsInternalError(options.auth, errorMessage)
  }

  const doc = snapshot.docs[0]
  const data = doc?.data()

  if (!doc || !data) {
    if (options.errorIfEmpty) {
      throw new FunctionsInternalError(options.auth, options.errorIfEmpty)
    }

    return undefined as CheckDocumentInQueryExistsResult<T, Options>
  }

  return {
    id: doc.id,
    ...data,
  } as T
}
