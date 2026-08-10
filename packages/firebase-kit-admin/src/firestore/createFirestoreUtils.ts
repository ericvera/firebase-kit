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
  const getFirestore = createGetFirestore(options)

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
    runBatch: createRunBatch(getFirestore),
    runTransaction: createRunTransaction(getFirestore),
  }
}
