import type {
  DocumentData,
  DocumentReference,
  Precondition,
  SetOptions,
  Transaction,
  UpdateData,
  WithFieldValue,
} from 'firebase-admin/firestore'

/**
 * A wrapper that only exposes write operations from a Firestore transaction.
 * This ensures functions can only write data and cannot perform reads.
 *
 * IMPORTANT: In Firestore transactions, all reads must complete before any
 * writes. Use this wrapper only after all read operations have been completed.
 */
export class TransactionWriter {
  constructor(private transaction: Transaction) {}

  set<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    data: WithFieldValue<AppModelType>,
    options?: SetOptions,
  ): this {
    if (options) {
      this.transaction.set(documentRef, data, options)
    } else {
      this.transaction.set(documentRef, data)
    }

    return this
  }

  update<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    data: UpdateData<DbModelType>,
    precondition?: Precondition,
  ): this {
    if (precondition) {
      this.transaction.update(documentRef, data, precondition)
    } else {
      this.transaction.update(documentRef, data)
    }

    return this
  }

  delete<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    precondition?: Precondition,
  ): this {
    if (precondition) {
      this.transaction.delete(documentRef, precondition)
    } else {
      this.transaction.delete(documentRef)
    }

    return this
  }

  create<AppModelType, DbModelType extends DocumentData>(
    documentRef: DocumentReference<AppModelType, DbModelType>,
    data: WithFieldValue<AppModelType>,
  ): this {
    this.transaction.create(documentRef, data)

    return this
  }
}
