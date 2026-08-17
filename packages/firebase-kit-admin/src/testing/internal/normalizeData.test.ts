import { Timestamp } from 'firebase-admin/firestore'
import { Buffer } from 'node:buffer'
import { expect, it } from 'vitest'
import { normalizeData } from './normalizeData.js'

const Early = Timestamp.fromMillis(1000)
const Late = Timestamp.fromMillis(5000)

const SortedTimestamps = [Early.valueOf(), Late.valueOf()]

it('replaces a timestamp with its zero-padded index in the sorted array', () => {
  const result = normalizeData(
    { createdAt: Early, updatedAt: Late },
    SortedTimestamps,
  )

  // Verify: the index comes from the caller's chronological array, so the same
  // instant reads the same across every document in a snapshot
  expect(result).toEqual({
    createdAt: '/Timestamp 0000/',
    updatedAt: '/Timestamp 0001/',
  })
})

it('throws when a timestamp is missing from the sorted array', () => {
  expect(() =>
    normalizeData({ createdAt: Early }, [Late.valueOf()]),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Timestamp not found in sorted array]`,
  )
})

it('replaces a buffer with its base64url encoding', () => {
  const result = normalizeData(
    { payload: Buffer.from('hello') },
    SortedTimestamps,
  )

  expect(result).toEqual({ payload: '/Buffer aGVsbG8/' })
})

it('walks nested objects and arrays', () => {
  const result = normalizeData(
    {
      audit: { updatedAt: Late },
      events: [{ at: Early }, 'plain', 7, true, null],
    },
    SortedTimestamps,
  )

  // Verify: primitives and null survive the walk unchanged while nested
  // timestamps are still replaced
  expect(result).toEqual({
    audit: { updatedAt: '/Timestamp 0001/' },
    events: [{ at: '/Timestamp 0000/' }, 'plain', 7, true, null],
  })
})

it('builds a new structure instead of mutating its input', () => {
  const data = { audit: { updatedAt: Late } }

  const result = normalizeData(data, SortedTimestamps)

  // Verify: the caller keeps its live document data — the diffing code reads
  // `doc.data()` again after normalizing
  expect(result).not.toBe(data)
  expect(data.audit.updatedAt).toBe(Late)
})
