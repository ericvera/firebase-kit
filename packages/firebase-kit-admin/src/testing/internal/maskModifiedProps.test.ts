import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { maskModifiedProps } from './maskModifiedProps.js'

const maskKeys = { entries: ['secret'] }

it('labels a changed masked string on each side', () => {
  const before = { secret: 'old' }
  const after = { secret: 'new' }

  maskModifiedProps(before, after, 'entries', maskKeys)

  // Verify: distinct tokens make jest-diff print the change as a `-` / `+` pair
  expect(before).toEqual({ secret: '/String (before)/' })
  expect(after).toEqual({ secret: '/String (after)/' })
})

it('keeps the plain token when the masked value did not change', () => {
  const before = { secret: 'same' }
  const after = { secret: 'same' }

  maskModifiedProps(before, after, 'entries', maskKeys)

  expect(before).toEqual({ secret: '/String/' })
  expect(after).toEqual({ secret: '/String/' })
})

it('keeps the plain token for a masked key present on one side only', () => {
  const before = { name: 'a' }
  const after = { name: 'a', secret: 'new' }

  maskModifiedProps(before, after, 'entries', maskKeys)

  // Verify: a one-sided key already prints as `+` or `-`, and masking never
  // introduces the key on the side that lacks it
  expect(before).toEqual({ name: 'a' })
  expect(after).toEqual({ name: 'a', secret: '/String/' })
})

it('leaves both sides untouched when the collection has no masks', () => {
  const before = { secret: 'old' }
  const after = { secret: 'new' }

  maskModifiedProps(before, after, 'spaces', maskKeys)

  expect(before).toEqual({ secret: 'old' })
  expect(after).toEqual({ secret: 'new' })
})

it('compares maps deeply', () => {
  const equalBefore = { secret: { a: 1, b: [2] } }
  const equalAfter = { secret: { a: 1, b: [2] } }
  const changedBefore = { secret: { a: 1 } }
  const changedAfter = { secret: { a: 2 } }

  maskModifiedProps(equalBefore, equalAfter, 'entries', maskKeys)
  maskModifiedProps(changedBefore, changedAfter, 'entries', maskKeys)

  // Verify: deep-equal maps are unchanged even though they are distinct objects
  expect(equalBefore).toEqual({ secret: '/Map/' })
  expect(equalAfter).toEqual({ secret: '/Map/' })
  expect(changedBefore).toEqual({ secret: '/Map (before)/' })
  expect(changedAfter).toEqual({ secret: '/Map (after)/' })
})

it('labels each side with its own type when the type changed', () => {
  const before = { secret: 'text' }
  const after = { secret: 7 }

  maskModifiedProps(before, after, 'entries', maskKeys)

  expect(before).toEqual({ secret: '/String (before)/' })
  expect(after).toEqual({ secret: '/Number (after)/' })
})

it('falls back to plain masking when a side is not an object', () => {
  const after = { secret: 'new' }

  maskModifiedProps(null, after, 'entries', maskKeys)

  // Verify: with no object to compare against, the object side gets the plain
  // token
  expect(after).toEqual({ secret: '/String/' })
})

it('compares raw Timestamps by instant', () => {
  const equalBefore = { secret: Timestamp.fromMillis(1000) }
  const equalAfter = { secret: Timestamp.fromMillis(1000) }
  const changedBefore = { secret: Timestamp.fromMillis(1000) }
  const changedAfter = { secret: Timestamp.fromMillis(2000) }

  maskModifiedProps(equalBefore, equalAfter, 'entries', maskKeys)
  maskModifiedProps(changedBefore, changedAfter, 'entries', maskKeys)

  // Verify: distinct instances of the same instant count as unchanged
  expect(equalBefore).toEqual({ secret: '/Timestamp/' })
  expect(equalAfter).toEqual({ secret: '/Timestamp/' })
  expect(changedBefore).toEqual({ secret: '/Timestamp (before)/' })
  expect(changedAfter).toEqual({ secret: '/Timestamp (after)/' })
})
