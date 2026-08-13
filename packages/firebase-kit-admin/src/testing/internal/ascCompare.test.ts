import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { ascCompare } from './ascCompare.js'

interface Doc {
  order: number
}

it('orders numbers from smallest to largest', () => {
  const docs: Doc[] = [{ order: 3 }, { order: 1 }, { order: 2 }]

  docs.sort(ascCompare((doc: Doc) => doc.order))

  // Verify: numbers compare by difference, so the result is ascending
  expect(docs.map((doc) => doc.order)).toEqual([1, 2, 3])
})

it('orders strings lexicographically', () => {
  const names = ['charlie', 'alpha', 'bravo']

  names.sort(ascCompare((name: string) => name))

  expect(names).toEqual(['alpha', 'bravo', 'charlie'])
})

it('keeps timestamps chronological through their string value', () => {
  const timestamps = [
    Timestamp.fromMillis(5000),
    Timestamp.fromMillis(1000),
    Timestamp.fromMillis(3000),
  ]

  timestamps.sort(ascCompare((timestamp: Timestamp) => timestamp.valueOf()))

  // Verify: `valueOf()` is zero-padded, so comparing it as a string — which is
  // how the snapshot diff orders documents by `updateTime` — stays in
  // chronological order
  expect(timestamps.map((timestamp) => timestamp.toMillis())).toEqual([
    1000, 3000, 5000,
  ])
})

it('throws when the two values are not both numbers or both strings', () => {
  const compare = ascCompare((value: number | string) => value)

  expect(() => compare(1, 'a')).toThrowErrorMatchingInlineSnapshot(
    `[Error: Trying to compare values that are not string or number]`,
  )
})
