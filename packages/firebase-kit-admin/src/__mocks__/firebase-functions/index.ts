import { vi } from 'vitest'
import { createFirebaseFunctionsMock } from '../../mocks/index.js'

// NOTE: Called once at module scope so every importer shares one logger spy.
const mock = createFirebaseFunctionsMock({
  actual:
    await vi.importActual<typeof import('firebase-functions')>(
      'firebase-functions',
    ),
})

export const { https, logger, onInit, pubsub } = mock
