import { beforeEach, expect, it, vi } from 'vitest'
import { initializeApp } from '../../__mocks__/firebase-admin/app/index.js'
import { createGetFirestore } from './createGetFirestore.js'
import { firestoreCacheResets } from './firestoreCacheResets.js'

const state = vi.hoisted(() => ({
  databaseIds: [] as string[],
}))

vi.mock('firebase-admin/app')

// Each initialization hands back a distinct object, which is what lets the
// cases below tell a re-initialized instance from the cached one.
vi.mock('firebase-admin/firestore', () => ({
  initializeFirestore: (
    _app: unknown,
    _settings: unknown,
    databaseId: string,
  ) => {
    state.databaseIds.push(databaseId)

    return { settings: () => undefined }
  },
}))

const options = {
  databaseId: 'named-db-id',
  emulatorDatabaseId: '(default)',
}

// Read at import time, before any case builds a binding. The registry is
// module state that keeps growing across the cases in this file, so an
// assertion made inside one of them would be about the file's history rather
// than the module's initial state.
const initialSize = firestoreCacheResets.size

beforeEach(() => {
  initializeApp()

  state.databaseIds = []
})

it('starts out holding no callbacks', () => {
  // Verify: importing the module registers nothing on its own — entries only
  // arrive when a binding is built
  expect(initialSize).toMatchInlineSnapshot(`0`)
})

it('gains one callback for every binding built', () => {
  const sizeBefore = firestoreCacheResets.size

  createGetFirestore(options)
  createGetFirestore(options)

  // Verify: registration is additive, so a second binding adds its own entry
  // instead of replacing the first one's
  expect(firestoreCacheResets.size - sizeBefore).toMatchInlineSnapshot(`2`)
})

it('registers a callback that drops only its own binding cache', () => {
  const first = createGetFirestore(options)

  const sizeBeforeSecond = firestoreCacheResets.size

  const second = createGetFirestore(options)

  const firstInstance = first()
  const secondInstance = second()

  for (const reset of [...firestoreCacheResets].slice(sizeBeforeSecond)) {
    reset()
  }

  // Verify: the entry the second binding added reaches that binding's cache
  // and no other — the first binding still hands back its original instance,
  // and only the second re-initializes
  expect({
    firstIsCached: first() === firstInstance,
    secondIsCached: second() === secondInstance,
    databaseIds: state.databaseIds,
  }).toMatchInlineSnapshot(`
    {
      "databaseIds": [
        "named-db-id",
        "named-db-id",
        "named-db-id",
      ],
      "firstIsCached": true,
      "secondIsCached": false,
    }
  `)
})
