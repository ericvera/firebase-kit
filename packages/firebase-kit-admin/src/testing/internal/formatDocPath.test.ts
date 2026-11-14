import { expect, it } from 'vitest'
import { formatDocPath } from './formatDocPath.js'

it('prints a bare id for a segment without a number', () => {
  expect(formatDocPath([{ collection: 'spaces', number: undefined }])).toBe(
    'spaces/[ID]',
  )
})

it('prints the number of a numbered segment', () => {
  expect(
    formatDocPath([
      { collection: 'spaces', number: 2 },
      { collection: 'entries', number: 10 },
      { collection: 'comments', number: undefined },
    ]),
  ).toBe('spaces/[ID 2]/entries/[ID 10]/comments/[ID]')
})
