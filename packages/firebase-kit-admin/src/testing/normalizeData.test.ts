import { Timestamp } from 'firebase-admin/firestore'
import { Buffer } from 'node:buffer'
import { expect, it, vi } from 'vitest'
import { normalizeData } from './normalizeData.js'

const Early = Timestamp.fromMillis(1000)
const Middle = Timestamp.fromMillis(3000)
const Late = Timestamp.fromMillis(5000)

it('indexes timestamps by chronological order, not by where they appear', () => {
  const result = normalizeData({
    updatedAt: Late,
    createdAt: Early,
    touchedAt: Middle,
  })

  // Verify: the index is assigned after sorting, so an assertion reads "this
  // field holds the earliest instant" rather than an unstable wall-clock value
  expect(result).toEqual({
    updatedAt: '/Timestamp 0002/',
    createdAt: '/Timestamp 0000/',
    touchedAt: '/Timestamp 0001/',
  })
})

it('gives the same index to the same instant across the structure', () => {
  const result = normalizeData({
    createdAt: Early,
    audit: { createdAt: Early, updatedAt: Late },
  })

  expect(result).toEqual({
    createdAt: '/Timestamp 0000/',
    audit: { createdAt: '/Timestamp 0000/', updatedAt: '/Timestamp 0001/' },
  })
})

it('replaces buffers with their base64url encoding', () => {
  const result = normalizeData({ payload: Buffer.from('hello') })

  expect(result).toEqual({ payload: '/Buffer aGVsbG8/' })
})

it('walks nested objects and arrays', () => {
  const result = normalizeData({
    name: 'entry',
    events: [{ at: Early }, { at: Late }],
    counts: [1, 2],
  })

  expect(result).toEqual({
    name: 'entry',
    events: [{ at: '/Timestamp 0000/' }, { at: '/Timestamp 0001/' }],
    counts: [1, 2],
  })
})

it('leaves data without timestamps or buffers alone', () => {
  const data = { name: 'entry', active: true, tags: ['a'], missing: null }

  const result = normalizeData(data)

  expect(result).toEqual(data)
  expect(result).not.toBe(data)
})

it('dumps the sorted timestamps when logging is enabled', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

  normalizeData({ updatedAt: Late, createdAt: Early }, { logTimestamps: true })

  // Verify: the dump lists the timestamps in the order the indices follow, so a
  // debugging session can map an index back to an instant
  expect(logSpy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "Found timestamp 062135596805.000000000 (1970-01-01T00:00:05.000Z) at path: updatedAt ",
      ],
      [
        "Found timestamp 062135596801.000000000 (1970-01-01T00:00:01.000Z) at path: createdAt ",
      ],
      [
        "
    Found timestamps (chronological order):",
      ],
      [
        "  000: 062135596801.000000000",
      ],
      [
        "  001: 062135596805.000000000",
      ],
      [
        "",
      ],
    ]
  `)
})

it('stays silent by default', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

  normalizeData({ createdAt: Early })

  expect(logSpy).not.toHaveBeenCalled()
})
