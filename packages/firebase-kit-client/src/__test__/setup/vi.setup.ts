// Installs an in-memory IndexedDB on `globalThis` before any test loads.
//
// The Firestore cache layer stores through `getsetdel`, which wraps
// `idb-keyval`, which needs IndexedDB. Neither Node nor happy-dom provides one,
// so without this every cached-read test would have to hand-write a fake store
// and assert on what that fake recorded instead of on what was actually stored.
import 'fake-indexeddb/auto'
