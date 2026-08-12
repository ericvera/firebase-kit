import type { Firestore, WriteBatch } from 'firebase-admin/firestore'
import { createCollectionDataPoint } from './internal/createCollectionDataPoint.js'
import { createGetFirestore } from './internal/createGetFirestore.js'
import { createNestedSubCollectionDataPoint } from './internal/createNestedSubCollectionDataPoint.js'
import { createRunBatch } from './internal/createRunBatch.js'
import { createRunTransaction } from './internal/createRunTransaction.js'
import { createSubCollectionDataPoint } from './internal/createSubCollectionDataPoint.js'
import type { FirestoreUtilsOptions } from './types.js'

/**
 * Entry point of the `./firestore` subpath. Called once per app — from the
 * app's own database barrel, which exports the result as `db` — with its
 * collection enums as type arguments and its database ids as values. Returns
 * the whole server-side Firestore access layer bound to them: the cached
 * `getFirestore`, the ref builders every ref module sits on, and the batch and
 * transaction helpers.
 *
 * The enums are type arguments rather than configuration because they are the
 * point: widening the collection parameter to `string` would delete the
 * compile-time guarantee that queries name a collection the app actually has.
 */
export const createFirestoreUtils = <
  TCollection extends string,
  TSubCollection extends string,
>(
  options: FirestoreUtilsOptions,
) => {
  // `Firestore` and `WriteBatch` are imported by name and written out here
  // rather than left inferred, so declaration emit reuses this file's
  // `firebase-admin/firestore` specifier. Left inferred it prints the global
  // `FirebaseFirestore.*` names, which come from `@google-cloud/firestore` — an
  // undeclared transitive of `firebase-admin`.
  const getFirestore: () => Firestore = createGetFirestore(options)

  const runBatch: <T = void>(
    callback: (batch: WriteBatch) => T | Promise<T>,
  ) => Promise<T> = createRunBatch(getFirestore)

  return {
    getFirestore,
    collectionDataPoint: createCollectionDataPoint<TCollection>(getFirestore),
    subCollectionDataPoint: createSubCollectionDataPoint<
      TCollection,
      TSubCollection
    >(getFirestore),
    nestedSubCollectionDataPoint: createNestedSubCollectionDataPoint<
      TCollection,
      TSubCollection
    >(getFirestore),
    runBatch,
    runTransaction: createRunTransaction(getFirestore),
  }
}
