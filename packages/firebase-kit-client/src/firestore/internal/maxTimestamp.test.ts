import { expect, it } from 'vitest'
import type { FirestoreTimestamp } from '../types.js'
import { maxTimestamp } from './maxTimestamp.js'

// Ordering is by `valueOf`, which is what both Firestore SDKs' Timestamp
// returns a sortable string from — so the mock only has to be sortable the
// same way.
const createTimestamp = (seconds: number): FirestoreTimestamp => ({
  seconds,
  nanoseconds: 0,
  toMillis: () => seconds * 1000,
  toDate: () => new Date(seconds * 1000),
  isEqual: (other) => other.seconds === seconds,
  valueOf: () => String(seconds).padStart(12, '0'),
})

it('returns the later of the two timestamps when the first is older', () => {
  const older = createTimestamp(10)
  const newer = createTimestamp(20)

  // Verify: the newer instance comes back, identity included, so the caller
  // keeps whichever object it was already holding
  expect(maxTimestamp(older, newer)).toBe(newer)
})

it('returns the later of the two timestamps when the first is newer', () => {
  const older = createTimestamp(10)
  const newer = createTimestamp(20)

  // Verify: argument order does not decide the winner
  expect(maxTimestamp(newer, older)).toBe(newer)
})

it('returns the second timestamp when both are equal', () => {
  const first = createTimestamp(10)
  const second = createTimestamp(10)

  // Verify: equal values are not "greater", so the comparison falls through to
  // the second — incremental queries stay put rather than oscillating
  expect(maxTimestamp(first, second)).toBe(second)
})
