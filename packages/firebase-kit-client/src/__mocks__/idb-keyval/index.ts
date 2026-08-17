// The in-memory IndexedDB the cache layer stores through in tests.
//
// `idb-keyval` is `getsetdel`'s dependency, not this package's. Mocking it here
// — rather than mocking `getsetdel` — swaps out only the storage underneath, so
// `getsetdel` itself stays real and a suite asserts on what was actually
// stored. `getsetdel` ships the replacement, so this shim is a pure re-export.
export * from 'getsetdel/testing/idb-keyval'
