import type { DocumentData, DocumentReference } from 'firebase/firestore/lite'
import type { FirestoreUtilsDependencies, ID, WithID } from '../types.js'

/**
 * Options for fetching a Firestore document.
 * @template DBT - The Firestore document data type
 */
export interface GetDocOptions<DBT extends DocumentData> {
  /** The ID of the document to fetch */
  id: ID
  /** Function that returns a Firestore document reference */
  getRef: (id: ID) => Promise<DocumentReference<DBT, DBT>>
}

export const createGetDoc = (dependencies: FirestoreUtilsDependencies) => {
  /**
   * Fetches a Firestore document and returns it with the ID field added.
   * Connectivity failures throw ConnectivityError (matching the *WithCache
   * variants) so callers get the offline treatment without wrapping.
   * @template DBT - The Firestore document data type
   * @template T - The type of the document with ID
   * @param options - The options for fetching the document
   * @returns The document data with ID, or undefined if document doesn't exist
   */
  const getDoc = async <
    DBT extends DocumentData,
    T extends WithID<DBT> = WithID<DBT>,
  >(
    options: GetDocOptions<DBT>,
  ): Promise<T | undefined> => {
    const { getDoc: getDocFromFirestore } =
      await import('firebase/firestore/lite')

    const docSnapshot = await dependencies.withConnectivityHandling(async () =>
      getDocFromFirestore(await options.getRef(options.id)),
    )

    const data = docSnapshot.data()

    if (!data) {
      return
    }

    return {
      id: options.id,
      ...data,
    } as T
  }

  return getDoc
}
