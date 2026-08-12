import { expect, it } from 'vitest'
import type { FirestoreTimestamp } from '../types.js'
import { trackLatestDocumentTimestamp } from './trackLatestDocumentTimestamp.js'

// `syncProp` narrows to the keys whose type *is* a Timestamp, so a document
// declaring the field as optional could not name it. The case under test is a
// document whose declared timestamp is missing at runtime, which is exactly
// what this fixture stands for.
const documentMissingTimestamp = { updated: undefined } as unknown as {
  updated: FirestoreTimestamp
}

const createTimestamp = (seconds: number): FirestoreTimestamp => ({
  seconds,
  nanoseconds: 0,
  toMillis: () => seconds * 1000,
  toDate: () => new Date(seconds * 1000),
  isEqual: (other) => other.seconds === seconds,
  valueOf: () => String(seconds).padStart(12, '0'),
})

it('adopts the document timestamp when nothing has been tracked yet', () => {
  const updated = createTimestamp(20)

  const result = trackLatestDocumentTimestamp(undefined, { updated }, 'updated')

  // Verify: the first document seen sets the incremental query's floor
  expect(result).toBe(updated)
})

it('advances the running value when the document is newer', () => {
  const newer = createTimestamp(30)

  const result = trackLatestDocumentTimestamp(
    createTimestamp(20),
    { updated: newer },
    'updated',
  )

  // Verify: the floor moves forward so the next query asks only for what
  // arrived after this document
  expect(result).toBe(newer)
})

it('keeps the running value when the document is older', () => {
  const running = createTimestamp(30)

  const result = trackLatestDocumentTimestamp(
    running,
    { updated: createTimestamp(20) },
    'updated',
  )

  // Verify: an out-of-order document cannot drag the floor backwards, which
  // would re-fetch everything between the two
  expect(result).toBe(running)
})

it('keeps the running value when the document has no timestamp', () => {
  const running = createTimestamp(30)

  const result = trackLatestDocumentTimestamp(
    running,
    documentMissingTimestamp,
    'updated',
  )

  // Verify: a document missing its sync field is skipped rather than resetting
  // the floor to undefined
  expect(result).toBe(running)
})

it('returns undefined when there is no running value and no timestamp', () => {
  const result = trackLatestDocumentTimestamp(
    undefined,
    documentMissingTimestamp,
    'updated',
  )

  // Verify: nothing to track yields nothing, so the next query stays unbounded
  expect(result).toBeUndefined()
})
