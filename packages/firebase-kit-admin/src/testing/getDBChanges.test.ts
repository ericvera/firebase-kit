import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { getDBChanges } from './getDBChanges.js'

const state = vi.hoisted(() => ({
  /** Arguments the underlying utility was called with. */
  calls: [] as unknown[][],
}))

vi.mock('firestore-snapshot-utils', () => ({
  getDBSnapshotChanges: (...args: unknown[]) => {
    state.calls.push(args)

    return { added: [], modified: [], removed: [] }
  },
}))

const before = [] as QueryDocumentSnapshot[]
const after = [] as QueryDocumentSnapshot[]

it('forwards both snapshots and the masks unchanged', () => {
  state.calls = []

  getDBChanges(before, after, { orders: ['updated'] })

  // Verify: the mask reaches the utility as given — the type parameter only
  // narrows what a caller may name, it must not reshape the value
  expect(state.calls).toEqual([[before, after, { orders: ['updated'] }]])
})

it('forwards undefined when the caller masks nothing', () => {
  state.calls = []

  getDBChanges(before, after)

  // Verify: an absent mask stays absent rather than becoming an empty object,
  // which the utility would read as "mask every collection with no keys"
  expect(state.calls).toEqual([[before, after, undefined]])
})
