import { Timestamp } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { extractTimestamps } from './extractTimestamps.js'

const Early = Timestamp.fromMillis(1000)
const Late = Timestamp.fromMillis(5000)

it('collects timestamps from nested objects and arrays', () => {
  const data = {
    createdAt: Early,
    audit: { updatedAt: Late },
    events: [{ at: Early }, 'not-a-timestamp', 7, null],
    name: 'entry',
  }

  const result = extractTimestamps(data)

  // Verify: the walk reaches into objects and arrays, ignores everything that
  // is not a Timestamp, and de-duplicates repeated values
  expect(Array.from(result)).toEqual([Early.valueOf(), Late.valueOf()])
})

it('returns an empty set when there are no timestamps', () => {
  expect(Array.from(extractTimestamps({ name: 'entry', tags: [] }))).toEqual([])
})

it('leaves its input untouched and returns the same values on a repeat call', () => {
  const data = { createdAt: Early }

  const first = extractTimestamps(data)
  const second = extractTimestamps(data)

  // Verify: extraction is idempotent — the same document can be walked once per
  // snapshot without the second pass seeing different values
  expect(Array.from(first)).toEqual(Array.from(second))
  expect(data.createdAt).toBe(Early)
})

it('logs each timestamp with its path when logging is enabled', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

  extractTimestamps(
    { audit: { updatedAt: Late } },
    { logTimestamps: true, docPath: 'entries/entry-1' },
  )

  // Verify: the debug line names the property path inside the document and the
  // document it came from, which is what makes the dump readable
  expect(logSpy.mock.calls).toMatchInlineSnapshot(`
    [
      [
        "Found timestamp 062135596805.000000000 (1970-01-01T00:00:05.000Z) at path: audit.updatedAt in document entries/entry-1",
      ],
    ]
  `)
})

it('stays silent when logging is not enabled', () => {
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)

  extractTimestamps({ audit: { updatedAt: Late } })

  expect(logSpy).not.toHaveBeenCalled()
})
