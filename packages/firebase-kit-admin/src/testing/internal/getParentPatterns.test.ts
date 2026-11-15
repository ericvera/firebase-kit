import { expect, it } from 'vitest'
import { getParentPatterns } from './getParentPatterns.js'

it('collects the collections that hold a parent of a changed document', () => {
  const parentPatterns = getParentPatterns([
    'people/person-1',
    'spaces/space-1/entries/entry-1/comments/comment-1',
  ])

  // Verify: every ancestor level counts, and a collection whose own documents
  // changed but have no changed children does not
  expect([...parentPatterns]).toEqual(['spaces', 'spaces/entries'])
})

it('returns nothing when only top-level documents changed', () => {
  expect(getParentPatterns(['spaces/space-1', 'people/person-1']).size).toBe(0)
})
