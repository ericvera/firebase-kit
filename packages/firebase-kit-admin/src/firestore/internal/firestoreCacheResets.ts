/**
 * Every bound Firestore accessor's cache-dropping callback, registered by
 * `createGetFirestore` as each binding is built.
 *
 * The registry is what lets `testGetFirestoreReset` be a plain package export
 * instead of a member of the object `createFirestoreUtils` returns — the cache
 * itself stays per-binding, so nothing here changes when or how often Firestore
 * is initialized. An app builds one binding, so in production this holds a
 * single entry for the life of the process.
 */
export const firestoreCacheResets = new Set<() => void>()
