import { testClearMockIndexedDB } from 'getsetdel/testing/idb-keyval'
import { beforeEach, vi } from 'vitest'

// Puts an in-memory IndexedDB behind the cache layer before any test loads.
//
// The Firestore cache layer stores through `getsetdel`, which wraps
// `idb-keyval`, which needs IndexedDB. Neither Node nor happy-dom provides one,
// so without this every cached-read test would have to hand-write a fake store
// and assert on what that fake recorded instead of on what was actually stored.
// Mocking the transitive dependency rather than `getsetdel` itself is what
// leaves `getsetdel` real.
vi.mock('idb-keyval', async () => import('getsetdel/testing/idb-keyval'))

// The backend holds its data in module scope, and `mockReset` does not touch
// it, so each case has to start from an empty store.
beforeEach(() => {
  testClearMockIndexedDB()
})
