import type { CollectionReference, Firestore } from 'firebase-admin/firestore'

/**
 * Ref builder `createCollectionDataPoint` hands back. Named so the collection
 * enum stays a type argument of the builder instead of collapsing to `string`.
 */
export interface CollectionDataPoint<TCollection extends string> {
  <T>(collection: TCollection): CollectionReference<T>
}

/**
 * Binds a `getFirestore` to a root-collection ref builder. `TCollection` is the
 * app's collection enum, so every ref module built on the result is checked
 * against the real set of collection names.
 */
export const createCollectionDataPoint =
  <TCollection extends string>(
    getFirestore: () => Firestore,
  ): CollectionDataPoint<TCollection> =>
  <T>(collection: TCollection): CollectionReference<T> =>
    getFirestore().collection(collection) as CollectionReference<T>
