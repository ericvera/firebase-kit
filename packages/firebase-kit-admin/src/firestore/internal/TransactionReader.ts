import type {
  AggregateQuery,
  AggregateQuerySnapshot,
  AggregateSpec,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
  Query,
  QuerySnapshot,
  Transaction,
} from 'firebase-admin/firestore'

/**
 * A wrapper that only exposes read operations from a Firestore transaction.
 * This ensures functions can only read data and cannot perform writes.
 *
 * Use this for functions that should only read data within a transaction.
 */
export class TransactionReader {
  constructor(private transaction: Transaction) {}

  get<AppModelType, DbModelType extends DocumentData>(
    query: Query<AppModelType, DbModelType>,
  ): Promise<QuerySnapshot<AppModelType, DbModelType>>
  get<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
  ): Promise<DocumentSnapshot<AppModelType, DbModelType>>
  get<
    AppModelType,
    DbModelType extends DocumentData,
    AggregateSpecType extends AggregateSpec,
  >(
    aggregateQuery: AggregateQuery<
      AggregateSpecType,
      AppModelType,
      DbModelType
    >,
  ): Promise<
    AggregateQuerySnapshot<AggregateSpecType, AppModelType, DbModelType>
  >
  get<AppModelType, DbModelType extends DocumentData>(
    documentRefOrQuery:
      | DocumentReference<AppModelType, DbModelType>
      | Query<AppModelType, DbModelType>
      | AggregateQuery<AggregateSpec, AppModelType, DbModelType>,
  ): Promise<
    | DocumentSnapshot<AppModelType, DbModelType>
    | QuerySnapshot<AppModelType, DbModelType>
    | AggregateQuerySnapshot<AggregateSpec, AppModelType, DbModelType>
  > {
    return this.transaction.get(
      documentRefOrQuery as Query<AppModelType, DbModelType>,
    )
  }

  getAll<AppModelType, DbModelType extends DocumentData>(
    ...documentRefsOrReadOptions: DocumentReference<AppModelType, DbModelType>[]
  ): Promise<DocumentSnapshot<AppModelType, DbModelType>[]> {
    return this.transaction.getAll(...documentRefsOrReadOptions)
  }
}
