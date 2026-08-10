import { createSetFakeTimer } from 'scdate-testing'

// The package cannot reach the product's shared time-zone constant, so the
// zone every test interprets its wall-clock timestamps in is declared here.
const TestTimeZone = 'America/Puerto_Rico'

/**
 * Used by any test in this package that needs a fixed clock. Sets vitest's
 * fake timers to the given local timestamp (`YYYY-MM-DDTHH:MM`) in the test
 * time zone and returns the matching epoch milliseconds, so a test asserts
 * against that value rather than a drifting `Date.now()`.
 */
export const setFakeTimer = createSetFakeTimer(TestTimeZone)
