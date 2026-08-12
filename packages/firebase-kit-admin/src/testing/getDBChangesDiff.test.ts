import type { DBSnapshotChanges } from 'firestore-snapshot-utils'
import { expect, it, vi } from 'vitest'
import { getDBChangesDiff } from './getDBChangesDiff.js'

vi.mock('firestore-snapshot-utils', () => ({
  getDiffFromDBSnapshotChanges: (changes: DBSnapshotChanges) =>
    `rendered ${Object.keys(changes).join(',')}`,
}))

it('renders the changes through the utility', () => {
  const changes = {
    added: [],
    modified: [],
    removed: [],
  } as unknown as DBSnapshotChanges

  // Verify: the printable diff comes straight from the utility — this wrapper
  // exists to name the operation, not to reshape it
  expect(getDBChangesDiff(changes)).toMatchInlineSnapshot(
    `"rendered added,modified,removed"`,
  )
})
