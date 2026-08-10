import type { GetSetDelStoreToken } from 'getsetdel'

/** Handed back while a fault is armed, so no real database is ever opened. */
const StubStoreToken = { dbName: 'stubbed-store' } as GetSetDelStoreToken

/**
 * Builds the stand-in a test suite re-exports from its `__mocks__/getsetdel`
 * module. Every call delegates to the real store — which runs against the
 * in-memory IndexedDB the package's vitest setup installs — so a suite asserts
 * on what was actually stored rather than on what a fake recorded.
 *
 * The one thing a suite cannot provoke from outside is the reset the store
 * raises when another tab wipes it, so `failEntriesWith` arms it.
 *
 * Arming it also stubs `createStore`, and that pairing is the point: the
 * cache layers retry a reset three times with an exponential backoff, a
 * suite driving that needs fake timers, and fake timers stall the real
 * IndexedDB — whose requests need genuine event-loop turns. Stubbing only the
 * read would leave `createStore` reopening a real database on every attempt
 * and hang the run.
 */
export const createGetSetDelMock = (actual: typeof import('getsetdel')) => {
  // Dropped rather than forwarded: its signature names a type getsetdel does
  // not export, which leaves this factory's own return type unnameable. No
  // consumer uses it.
  const { queryInventory: _queryInventory, ...rest } = actual

  let entriesError: Error | undefined = undefined
  let stubbed = false

  return {
    ...rest,

    createStore: (info: Parameters<typeof actual.createStore>[0]) =>
      stubbed ? Promise.resolve(StubStoreToken) : actual.createStore(info),

    entries: (...args: Parameters<typeof actual.entries>) => {
      if (entriesError !== undefined) {
        return Promise.reject(entriesError)
      }

      return stubbed ? Promise.resolve([]) : actual.entries(...args)
    },

    setMany: (...args: Parameters<typeof actual.setMany>) =>
      stubbed ? Promise.resolve() : actual.setMany(...args),

    delMany: (...args: Parameters<typeof actual.delMany>) =>
      stubbed ? Promise.resolve() : actual.delMany(...args),

    /** Makes every cache read reject, leaving the rest of the store real. */
    failEntriesWith: (error: Error) => {
      entriesError = error
    },

    /** Lets reads succeed again. */
    clearEntriesFault: () => {
      entriesError = undefined
    },

    /**
     * Takes the store out of play entirely for the rest of the case.
     *
     * Only the retry-loop cases need this: they reopen the store on every
     * attempt and drive the backoff with fake timers, which stall the real
     * IndexedDB. Everything else should keep the real store.
     */
    stubStore: () => {
      stubbed = true
    },

    /** Disarms everything, putting the real store back in play. */
    resetGetSetDelMock: () => {
      entriesError = undefined
      stubbed = false
    },
  }
}
