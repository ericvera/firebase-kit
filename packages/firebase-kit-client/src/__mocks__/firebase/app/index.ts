import { createFirebaseAppMock } from '../../../testing/index.js'

// NOTE: Called once at module scope so every importer shares one app registry.
const mock = createFirebaseAppMock()

export const { getApp, getApps, initializeApp, resetFirebaseAppMocks } = mock
