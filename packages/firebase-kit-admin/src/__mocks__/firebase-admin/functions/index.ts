import { createFirebaseAdminFunctionsMock } from '../../../mocks/index.js'

// NOTE: Called once at module scope so every importer shares one queue state.
const mock = createFirebaseAdminFunctionsMock()

export const {
  enqueueMock,
  getEnqueuedTasks,
  getFunctions,
  resetFunctionsMock,
  setEnqueueFailure,
  taskQueueMock,
} = mock
