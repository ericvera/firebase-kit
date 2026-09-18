import { createGetSetDelMock } from 'getsetdel/testing'
import { vi } from 'vitest'

// NOTE: Called once at module scope so every importer shares one fault switch.
const mock = createGetSetDelMock(
  await vi.importActual<typeof import('getsetdel')>('getsetdel'),
)

export const {
  clear,
  clearEntriesFault,
  del,
  delMany,
  entries,
  failEntriesWith,
  get,
  getMany,
  getMeta,
  GetSetDelResetError,
  handleResetError,
  keys,
  queryInventory,
  resetGetSetDelMock,
  set,
  setMany,
  setMeta,
  simulateStoreReset,
  stubStore,
} = mock

// A spy rather than a plain re-export, so a test can wrap a single open of the
// store, for instance to wipe it the moment it is opened. `mockReset` restores
// this implementation after each case.
export const createStore = vi.fn(mock.createStore)
