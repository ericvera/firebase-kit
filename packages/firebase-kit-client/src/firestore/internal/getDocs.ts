import type { DocumentData, Query } from 'firebase/firestore/lite'
import type { FirestoreUtilsDependencies, WithID } from '../types.js'
import { fetchDocs } from './fetchDocs.js'

/**
 * Options for fetching Firestore documents.
 * @template DBT - The Firestore document data type
 */
export interface GetDocsOptions<DBT extends DocumentData> {
  /** Function that returns a Firestore query */
  getQuery: () => Promise<Query<DBT, DBT>>
}

export const createGetDocs = (dependencies: FirestoreUtilsDependencies) => {
  /**
   * Fetches Firestore documents and returns them with ID fields added.
   * This is a simplified version without persistent caching - suitable for
   * short-lived operations like search where in-memory caching is sufficient.
   * Connectivity failures throw ConnectivityError (matching the *WithCache
   * variants) so callers get the offline treatment without wrapping.
   * @template DBT - The Firestore document data type
   * @template T - The type of the documents with ID
   * @param options - The options for fetching documents
   * @returns Array of documents with IDs
   */
  const getDocs = async <
    DBT extends DocumentData,
    T extends WithID<DBT> = WithID<DBT>,
  >(
    options: GetDocsOptions<DBT>,
  ): Promise<T[]> => {
    const querySnapshot = await dependencies.withConnectivityHandling(() =>
      fetchDocs(options),
    )

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[]
  }

  return getDocs
}
