import { createFirebaseAdminAuthMock } from '../../../mocks/index.js'

// NOTE: Called once at module scope so every importer shares one directory.
const mock = createFirebaseAdminAuthMock()

export const { getAuth } = mock
