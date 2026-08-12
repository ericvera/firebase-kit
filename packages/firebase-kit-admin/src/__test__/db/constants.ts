/** Document ids the emulator tests seed and read back. */
export const TestSpaceID1 = 'space-id-1'
export const TestPersonID1 = 'person-id-1'
export const TestPersonID2 = 'person-id-2'
export const TestEntryID1 = 'entry-id-1'
export const TestNestedEntryID1 = 'nested-entry-id-1'

/** An id no test ever seeds, so a read against it always comes back empty. */
export const TestNonExistentID1 = 'missing-id-1'

/** Default field values the two fixture builders write. */
export const TestSpaceName1 = 'Test Space'
export const TestSpaceHandle1 = 'test-space-1'
export const TestPersonDisplayName1 = 'Test Person'
export const TestPersonHandle1 = 'test-person-1'
export const TestEntryLabel1 = 'Test Entry'
export const TestNestedEntryLabel1 = 'Test Nested Entry'

/** Schema version stamped on every seeded document. */
export const TestSchemaVersion = 1
