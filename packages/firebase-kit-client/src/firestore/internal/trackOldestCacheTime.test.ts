import { expect, it } from 'vitest'
import { trackOldestCacheTime } from './trackOldestCacheTime.js'

it('adopts the first cache time when nothing has been tracked yet', () => {
  // Verify: with no running value the incoming one is taken as is
  expect(trackOldestCacheTime(undefined, 1_700_000_000_000)).toEqual(
    1_700_000_000_000,
  )
})

it('keeps the running value when the new cache time is later', () => {
  // Verify: staleness is decided by the oldest entry, so a newer one does not
  // move it
  expect(trackOldestCacheTime(1_600_000_000_000, 1_700_000_000_000)).toEqual(
    1_600_000_000_000,
  )
})

it('takes the new cache time when it is older than the running value', () => {
  // Verify: an older entry does move it — the collection is only as fresh as
  // its stalest document
  expect(trackOldestCacheTime(1_700_000_000_000, 1_600_000_000_000)).toEqual(
    1_600_000_000_000,
  )
})

it('keeps a running value of zero rather than treating it as untracked', () => {
  // Verify: epoch zero is a real cache time, so it wins over a later one — the
  // guard tests for undefined, not for falsiness
  expect(trackOldestCacheTime(0, 1_700_000_000_000)).toEqual(0)
})
