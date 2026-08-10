import type { DocumentData, Query } from 'firebase/firestore/lite'

interface FetchDocsOptions<DBT extends DocumentData> {
  getQuery: () => Promise<Query<DBT, DBT>>
}

export const fetchDocs = async <DBT extends DocumentData>(
  options: FetchDocsOptions<DBT>,
) => {
  const { getDocs: getDocsFromFirestore } =
    await import('firebase/firestore/lite')

  const query = await options.getQuery()

  return getDocsFromFirestore(query)
}
