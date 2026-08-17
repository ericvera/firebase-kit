import { createGetSetDelMock } from 'getsetdel/testing'
import { vi } from 'vitest'

// NOTE: Called once at module scope so every importer shares one fault switch.
const mock = createGetSetDelMock(
  await vi.importActual<typeof import('getsetdel')>('getsetdel'),
)

export const {
  clear,
  clearEntriesFault,
  createStore,
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
