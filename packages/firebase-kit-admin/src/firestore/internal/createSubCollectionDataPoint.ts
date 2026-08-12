import type { CollectionReference, Firestore } from 'firebase-admin/firestore'

/**
 * Ref builder `createSubCollectionDataPoint` hands back. Named so both enums
 * stay type arguments of the builder instead of collapsing to `string`.
 */
export interface SubCollectionDataPoint<
  TCollection extends string,
  TSubCollection extends string,
> {
  <T>(
    parentCollection: TCollection,
    parentId: string,
    subCollection: TSubCollection,
  ): CollectionReference<T>
}

/**
 * Binds a `getFirestore` to a one-level-nested ref builder, e.g.
 * `spaces/{spaceId}/entries`.
 */
export const createSubCollectionDataPoint =
  <TCollection extends string, TSubCollection extends string>(
    getFirestore: () => Firestore,
  ): SubCollectionDataPoint<TCollection, TSubCollection> =>
  <T>(
    parentCollection: TCollection,
    parentId: string,
    subCollection: TSubCollection,
  ): CollectionReference<T> =>
    getFirestore()
      .collection(parentCollection)
      .doc(parentId)
      .collection(subCollection) as CollectionReference<T>
