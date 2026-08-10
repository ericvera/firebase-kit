import { createFirebaseAdminAppMock } from '../../../mocks/index.js'

// NOTE: Called once at module scope so every importer shares one app registry.
const mock = createFirebaseAdminAppMock()

export const {
  cert,
  getApp,
  getApps,
  getCertifiedConfigs,
  getInitializeAppOptions,
  initializeApp,
  resetFirebaseAdminAppMocks,
} = mock
