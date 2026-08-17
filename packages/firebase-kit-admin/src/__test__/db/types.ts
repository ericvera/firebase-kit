import type { Timestamp } from 'firebase-admin/firestore'

/**
 * Document shape of the `spaces` collection — the sample this package's
 * emulator tests use wherever a consuming app would have one of its own
 * top-level entities. Deliberately synthetic: nothing here mirrors a real
 * product schema.
 */
export interface DBSpace {
  v: number
  created: Timestamp
  updated: Timestamp
  name: string
  handle: string
}

/**
 * Document shape of the `people` collection, used by the query-based checks.
 * `handle` is the field those queries filter on and `stats` is here so a nested
 * object round-trips through the read path.
 */
export interface DBPerson {
  v: number
  created: Timestamp
  updated: Timestamp
  handle: string
  displayName: string
  stats: {
    active: number
    archived: number
  }
}

/**
 * Document shape of the `entries` sub-collection, which is seeded both one and
 * two levels down so the nested ref builders have something real to read back.
 */
export interface DBEntry {
  v: number
  created: Timestamp
  updated: Timestamp
  label: string
}
