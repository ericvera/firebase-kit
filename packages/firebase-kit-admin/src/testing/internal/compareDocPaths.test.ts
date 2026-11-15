import { expect, it } from 'vitest'
import { compareDocPaths } from './compareDocPaths.js'
import { formatDocPath } from './formatDocPath.js'
import type { DocPathSegment } from './getDocPathSegments.js'

it('sorts a parent directly ahead of its children', () => {
  const segments = (
    ...pairs: [collection: string, number?: number][]
  ): DocPathSegment[] =>
    pairs.map(([collection, number]) => ({ collection, number }))

  const paths = [
    segments(['spaces', 2], ['entries', 1]),
    segments(['spaces-archive']),
    segments(['spaces', 1], ['entries', 2]),
    segments(['spaces', 2]),
    segments(['spaces', 10]),
    segments(['spaces', 1], ['members']),
    segments(['spaces', 1], ['entries', 1], ['comments']),
    segments(['people']),
    segments(['spaces', 1]),
    segments(['spaces', 1], ['entries', 1]),
  ]

  paths.sort(compareDocPaths)

  // Verify: each document is followed by its own subtree before its next
  // sibling, numbers compare as numbers, and a collection whose name merely
  // starts with another's sorts after that collection's whole tree
  expect(paths.map(formatDocPath)).toEqual([
    'people/[ID]',
    'spaces/[ID 1]',
    'spaces/[ID 1]/entries/[ID 1]',
    'spaces/[ID 1]/entries/[ID 1]/comments/[ID]',
    'spaces/[ID 1]/entries/[ID 2]',
    'spaces/[ID 1]/members/[ID]',
    'spaces/[ID 2]',
    'spaces/[ID 2]/entries/[ID 1]',
    'spaces/[ID 10]',
    'spaces-archive/[ID]',
  ])
})

it('reports two documents printed alike as equal', () => {
  const path: DocPathSegment[] = [{ collection: 'spaces', number: undefined }]

  expect(compareDocPaths(path, [...path])).toBe(0)
})
