import type { FirestoreTimestamp } from '../types.js'

export const maxTimestamp = (
  a: FirestoreTimestamp,
  b: FirestoreTimestamp,
): FirestoreTimestamp => (a > b ? a : b)
