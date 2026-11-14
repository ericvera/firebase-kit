import { expect, it } from 'vitest'
import { getCollectionPatterns } from './getCollectionPatterns.js'

it('returns the collection of a top-level document', () => {
  expect(getCollectionPatterns('spaces/space-1')).toEqual(['spaces'])
})

it('returns one pattern per level, outermost first', () => {
  // Verify: the ids are dropped, so two documents under different parents
  // share a pattern
  expect(
    getCollectionPatterns('spaces/space-1/entries/entry-1/comments/comment-1'),
  ).toEqual(['spaces', 'spaces/entries', 'spaces/entries/comments'])
  expect(
    getCollectionPatterns('spaces/space-2/entries/entry-9/comments/comment-4'),
  ).toEqual(['spaces', 'spaces/entries', 'spaces/entries/comments'])
})
