import type { CollectionReference, Firestore } from 'firebase-admin/firestore'

/**
 * Ref builder `createNestedSubCollectionDataPoint` hands back. Named so both
 * enums stay type arguments of the builder instead of collapsing to `string`.
 */
export interface NestedSubCollectionDataPoint<
  TCollection extends string,
  TSubCollection extends string,
> {
  <T>(
    parentCollection: TCollection,
    parentId: string,
    subCollection: TSubCollection,
    subId: string,
    nestedSubCollection: TSubCollection,
  ): CollectionReference<T>
}

/**
 * Binds a `getFirestore` to a two-levels-nested ref builder, e.g.
 * `spaces/{spaceId}/people/{personId}/entries`.
 */
export const createNestedSubCollectionDataPoint =
  <TCollection extends string, TSubCollection extends string>(
    getFirestore: () => Firestore,
  ): NestedSubCollectionDataPoint<TCollection, TSubCollection> =>
  <T>(
    parentCollection: TCollection,
    parentId: string,
    subCollection: TSubCollection,
    subId: string,
    nestedSubCollection: TSubCollection,
  ): CollectionReference<T> =>
    getFirestore()
      .collection(parentCollection)
      .doc(parentId)
      .collection(subCollection)
      .doc(subId)
      .collection(nestedSubCollection) as CollectionReference<T>
