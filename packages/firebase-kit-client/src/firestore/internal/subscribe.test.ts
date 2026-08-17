import type { Query } from 'firebase/firestore'
import { expect, it, vi } from 'vitest'
import { createTestFirestoreDependencies } from '../../__test__/utils/createTestFirestoreDependencies.js'
import type { FirestoreUtilsDependencies } from '../types.js'
import { FirestorePermissionDeniedCode } from './constants.js'
import { createSubscribe } from './subscribe.js'

const state = vi.hoisted(() => ({
  /** Handlers the SDK captured for the current listener. */
  onNext: undefined as ((snapshot: unknown) => void) | undefined,
  onError: undefined as ((error: unknown) => void) | undefined,
  /** How many times the returned teardown was invoked. */
  unsubscribed: 0,
  /** Set to make onSnapshot throw before it registers anything. */
  registerError: undefined as Error | undefined,
}))

vi.mock('firebase/firestore', () => ({
  onSnapshot: (
    _query: unknown,
    onNext: (snapshot: unknown) => void,
    onError: (error: unknown) => void,
  ) => {
    if (state.registerError !== undefined) {
      throw state.registerError
    }

    state.onNext = onNext
    state.onError = onError

    return () => {
      state.unsubscribed += 1
    }
  },
}))

interface DocChange {
  type: 'added' | 'modified' | 'removed'
  id: string
  data: Record<string, unknown>
}

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies()

const createSnapshot = (changes: DocChange[]) => ({
  docChanges: () =>
    changes.map((change) => ({
      type: change.type,
      doc: { id: change.id, data: () => change.data },
    })),
})

const createOptions = (
  overrides: Partial<Parameters<ReturnType<typeof createSubscribe>>[0]> = {},
) => ({
  subscribeQuery: () => Promise.resolve({} as Query),
  onUpdates: () => undefined,
  onError: () => undefined,
  isLoggedIn: () => true,
  ...overrides,
})

const reset = () => {
  state.onNext = undefined
  state.onError = undefined
  state.unsubscribed = 0
  state.registerError = undefined
}

it('splits a snapshot into documents to set and documents to remove', async () => {
  reset()

  const updates: unknown[] = []
  const subscribe = createSubscribe(createDependencies())

  await subscribe(createOptions({ onUpdates: (u) => updates.push(u) }))

  state.onNext?.(
    createSnapshot([
      { type: 'added', id: 'entry-1', data: { total: 100 } },
      { type: 'modified', id: 'entry-2', data: { total: 200 } },
      { type: 'removed', id: 'entry-3', data: {} },
    ]),
  )

  // Verify: added and modified both land in `set` with their data, removed
  // lands in `remove` as a bare id
  expect(updates).toMatchInlineSnapshot(`
    [
      {
        "remove": [
          "entry-3",
        ],
        "set": [
          [
            "entry-1",
            {
              "total": 100,
            },
          ],
          [
            "entry-2",
            {
              "total": 200,
            },
          ],
        ],
      },
    ]
  `)
})

it('routes a document the caller wants removed into the remove list', async () => {
  reset()

  const updates: unknown[] = []
  const subscribe = createSubscribe(createDependencies())

  await subscribe(
    createOptions({
      onUpdates: (u) => updates.push(u),
      shouldRemove: (doc) =>
        Boolean((doc as { cancelled?: boolean }).cancelled),
    }),
  )

  state.onNext?.(
    createSnapshot([
      { type: 'added', id: 'entry-1', data: { cancelled: true } },
    ]),
  )

  // Verify: shouldRemove overrides the change type — an added-but-cancelled
  // document is a removal as far as the store is concerned
  expect(updates).toMatchInlineSnapshot(`
    [
      {
        "remove": [
          "entry-1",
        ],
        "set": [],
      },
    ]
  `)
})

it('reports an error thrown while processing a snapshot', async () => {
  reset()

  const errors: unknown[] = []
  const subscribe = createSubscribe(createDependencies())

  await subscribe(
    createOptions({
      onUpdates: () => {
        throw new Error('store write failed')
      },
      onError: (error) => errors.push(error),
    }),
  )

  state.onNext?.(createSnapshot([{ type: 'added', id: 'entry-1', data: {} }]))

  // Verify: a failure inside the update callback reaches onError rather than
  // escaping into the SDK, where nothing would catch it
  expect(errors).toMatchInlineSnapshot(`
    [
      [Error: store write failed],
    ]
  `)
})

it('suppresses a permission-denied that lands after logout', async () => {
  reset()

  const errors: unknown[] = []
  const subscribe = createSubscribe(createDependencies())

  await subscribe(
    createOptions({
      onError: (error) => errors.push(error),
      isLoggedIn: () => false,
    }),
  )

  state.onError?.({ code: FirestorePermissionDeniedCode })

  // Verify: the signOut teardown race is expected noise — every listener is
  // auth-gated, so a denial while logged out can only be that
  expect(errors).toMatchInlineSnapshot(`[]`)
})

it('reports a permission-denied that lands while still logged in', async () => {
  reset()

  const errors: unknown[] = []
  const subscribe = createSubscribe(createDependencies())

  await subscribe(
    createOptions({
      onError: (error) => errors.push(error),
      isLoggedIn: () => true,
    }),
  )

  const denial = { code: FirestorePermissionDeniedCode }

  state.onError?.(denial)

  // Verify: a denial with a live session is a real fault — stale claims or a
  // rules bug — and must not be swallowed
  expect(errors).toEqual([denial])
})

it('reports a non-permission listener error regardless of session', async () => {
  reset()

  const errors: unknown[] = []
  const subscribe = createSubscribe(createDependencies())

  await subscribe(
    createOptions({
      onError: (error) => errors.push(error),
      isLoggedIn: () => false,
    }),
  )

  const unavailable = { code: 'unavailable' }

  state.onError?.(unavailable)

  // Verify: only permission-denied is suppressed by the logout check
  expect(errors).toEqual([unavailable])
})

it('reports a failure to open the subscription at all', async () => {
  reset()
  state.registerError = new Error('query build failed')

  const errors: unknown[] = []
  const subscribe = createSubscribe(createDependencies())

  await subscribe(createOptions({ onError: (error) => errors.push(error) }))

  // Verify: a throw during setup reaches onError instead of rejecting the
  // subscribe call, so a caller's teardown handle is still returned
  expect(errors).toMatchInlineSnapshot(`
    [
      [Error: query build failed],
    ]
  `)
})

it('tears the listener down through the returned handle', async () => {
  reset()

  const subscribe = createSubscribe(createDependencies())

  const unsubscribe = await subscribe(createOptions())

  unsubscribe()

  // Verify: the handle forwards to the SDK's own teardown exactly once
  expect(state.unsubscribed).toEqual(1)
})
