import { beforeEach, expect, it, vi } from 'vitest'
import { initializeApp } from '../../__mocks__/firebase-admin/app/index.js'
import { createGetFirestore } from './createGetFirestore.js'
import { createRunBatch } from './createRunBatch.js'

const state = vi.hoisted(() => ({ log: [] as string[] }))

vi.mock('firebase-admin/app')

// Registered once at module scope: `getFirestore` is called lazily inside each
// case and throws unless the shared registry already holds an app.
initializeApp()

vi.mock('firebase-admin/firestore', () => ({
  initializeFirestore: () => ({
    settings: () => undefined,
    batch: () => {
      state.log.push('batch')

      return {
        commit: () => {
          state.log.push('commit')

          return Promise.resolve()
        },
      }
    },
  }),
}))

const getFirestore = createGetFirestore({
  databaseId: 'test-db-id',
  emulatorDatabaseId: '(default)',
})

const runBatch = createRunBatch(getFirestore)

beforeEach(() => {
  state.log = []
})

it('commits after an async callback resolves and returns its value', async () => {
  const result = await runBatch(() => {
    state.log.push('callback')

    return 'written'
  })

  // Verify: the batch is created before the callback, the commit only happens
  // once the callback has resolved, and the callback's value is returned
  expect({ result, log: state.log }).toMatchInlineSnapshot(`
    {
      "log": [
        "batch",
        "callback",
        "commit",
      ],
      "result": "written",
    }
  `)
})

it('commits after a synchronous callback with no return value', async () => {
  await runBatch(() => {
    state.log.push('callback')
  })

  // Verify: a void callback still gets a batch and still commits
  expect(state.log).toMatchInlineSnapshot(`
    [
      "batch",
      "callback",
      "commit",
    ]
  `)
})
