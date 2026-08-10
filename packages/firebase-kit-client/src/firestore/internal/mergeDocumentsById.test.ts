import { expect, it } from 'vitest'
import { mergeDocumentsById } from './mergeDocumentsById.js'

it('appends new documents after the cached ones', () => {
  const result = mergeDocumentsById(
    [{ id: 'a', name: 'cached a' }],
    [{ id: 'b', name: 'fresh b' }],
  )

  // Verify: both survive, cached first — the order a cached-then-fetched read
  // hands to the caller
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "id": "a",
        "name": "cached a",
      },
      {
        "id": "b",
        "name": "fresh b",
      },
    ]
  `)
})

it('lets a new document replace the cached one with the same id', () => {
  const result = mergeDocumentsById(
    [{ id: 'a', name: 'stale a' }],
    [{ id: 'a', name: 'fresh a' }],
  )

  // Verify: one entry, holding the fresh value — a refetched document must not
  // come back twice, and must not come back stale
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "id": "a",
        "name": "fresh a",
      },
    ]
  `)
})

it('keeps the last occurrence when the cached list itself repeats an id', () => {
  const result = mergeDocumentsById(
    [
      { id: 'a', name: 'first a' },
      { id: 'a', name: 'second a' },
    ],
    [],
  )

  // Verify: a duplicated cache entry collapses to one, taking the later value
  expect(result).toMatchInlineSnapshot(`
    [
      {
        "id": "a",
        "name": "second a",
      },
    ]
  `)
})

it('returns an empty list when neither side has documents', () => {
  // Verify: the empty case is an empty array, not undefined
  expect(mergeDocumentsById([], [])).toMatchInlineSnapshot(`[]`)
})
