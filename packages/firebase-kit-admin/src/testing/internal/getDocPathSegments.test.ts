import { expect, it } from 'vitest'
import { getDocPathSegments } from './getDocPathSegments.js'

const numbers = new Map([
  ['spaces/space-1', 1],
  ['spaces/space-2', 2],
  ['spaces/space-1/entries/entry-1', 1],
  ['spaces/space-1/entries/entry-1/comments/comment-1', 1],
])

const NoParentPatterns = new Set<string>()

it('leaves a document unnumbered when its collection holds no parent', () => {
  expect(
    getDocPathSegments('spaces/space-2', numbers, NoParentPatterns),
  ).toEqual([{ collection: 'spaces', number: undefined }])
})

it('numbers every ancestor', () => {
  expect(
    getDocPathSegments(
      'spaces/space-1/entries/entry-1/comments/comment-1',
      numbers,
      NoParentPatterns,
    ),
  ).toEqual([
    { collection: 'spaces', number: 1 },
    { collection: 'entries', number: 1 },
    { collection: 'comments', number: undefined },
  ])
})

it("numbers a document when its collection holds a changed document's parent", () => {
  const parentPatterns = new Set(['spaces'])

  // Verify: both spaces are numbered, the parent and its sibling alike, so a
  // parent reads the same in its own section and in its children's
  expect(getDocPathSegments('spaces/space-1', numbers, parentPatterns)).toEqual(
    [{ collection: 'spaces', number: 1 }],
  )
  expect(getDocPathSegments('spaces/space-2', numbers, parentPatterns)).toEqual(
    [{ collection: 'spaces', number: 2 }],
  )
  expect(
    getDocPathSegments(
      'spaces/space-1/entries/entry-1',
      numbers,
      parentPatterns,
    ),
  ).toEqual([
    { collection: 'spaces', number: 1 },
    { collection: 'entries', number: undefined },
  ])
})

it('throws when an ancestor is missing from the snapshot', () => {
  // Verify: the error names the missing ancestor and the collection to add to
  // the snapshot
  expect(() =>
    getDocPathSegments(
      'spaces/space-9/entries/entry-1',
      numbers,
      NoParentPatterns,
    ),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Document not found for path: spaces/space-9 (an ancestor of spaces/space-9/entries/entry-1). Add a ref or query covering the spaces collection to getDBSnapshot, so the ancestor is in the snapshot.]`,
  )
})

it('throws naming the missing ancestor at any depth', () => {
  expect(() =>
    getDocPathSegments(
      'spaces/space-1/entries/entry-9/comments/comment-1',
      numbers,
      NoParentPatterns,
    ),
  ).toThrowErrorMatchingInlineSnapshot(
    `[Error: Document not found for path: spaces/space-1/entries/entry-9 (an ancestor of spaces/space-1/entries/entry-9/comments/comment-1). Add a ref or query covering the spaces/space-1/entries collection to getDBSnapshot, so the ancestor is in the snapshot.]`,
  )
})
