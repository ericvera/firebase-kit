import type {
  DocumentData,
  Query,
  QuerySnapshot,
} from 'firebase/firestore/lite'

interface FetchDocsOptions<DBT extends DocumentData> {
  getQuery: () => Promise<Query<DBT, DBT>>
}

// The return type is written out rather than left inferred so that declaration
// emit reuses the `firebase/firestore/lite` specifier this file already
// imports. Inferred, it resolves the symbol back to `@firebase/firestore/lite`,
// which is where the barrel re-exports it from and which this package does not
// declare.
export const fetchDocs = async <DBT extends DocumentData>(
  options: FetchDocsOptions<DBT>,
): Promise<QuerySnapshot<DBT, DBT>> => {
  const { getDocs: getDocsFromFirestore } =
    await import('firebase/firestore/lite')

  const query = await options.getQuery()

  return getDocsFromFirestore(query)
}
