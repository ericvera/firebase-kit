import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
} from 'firebase/firestore/lite'
import type { FirestoreUtilsDependencies, WithID } from '../types.js'
import { fetchDocs } from './fetchDocs.js'

/**
 * Options for fetching Firestore documents.
 * @template DBT - The Firestore document data type
 */
export interface GetDocsWithCursorOptions<DBT extends DocumentData> {
  /** Function that returns a Firestore query */
  getQuery: () => Promise<Query<DBT, DBT>>
}

/**
 * Result of fetching Firestore documents, including cursor for pagination.
 * @template DBT - The Firestore document data type
 * @template T - The type of documents in the collection with id field
 */
export interface GetDocsWithCursorResult<
  DBT extends DocumentData,
  T extends WithID<DBT> = WithID<DBT>,
> {
  documents: T[]
  lastDocumentSnapshot: QueryDocumentSnapshot<DBT, DBT> | undefined
}

export const createGetDocsWithCursor = (
  dependencies: FirestoreUtilsDependencies,
) => {
  /**
   * Like {@link import('./getDocs.js').getDocs getDocs} but also returns the
   * last document snapshot for cursor-based pagination. Connectivity failures
   * throw ConnectivityError, matching getDocs.
   */
  const getDocsWithCursor = async <
    DBT extends DocumentData,
    T extends WithID<DBT> = WithID<DBT>,
  >(
    options: GetDocsWithCursorOptions<DBT>,
  ): Promise<GetDocsWithCursorResult<DBT, T>> => {
    const querySnapshot = await dependencies.withConnectivityHandling(() =>
      fetchDocs(options),
    )

    const documents = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as T[]

    const lastDocumentSnapshot =
      querySnapshot.docs[querySnapshot.docs.length - 1]

    return { documents, lastDocumentSnapshot }
  }

  return getDocsWithCursor
}
