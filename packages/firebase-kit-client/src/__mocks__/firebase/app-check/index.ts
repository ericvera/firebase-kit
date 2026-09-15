import { type Mock, vi } from 'vitest'

// App Check hands out a token only behind a real provider and a registered
// site key, so the exchange is stubbed and each test sets its own outcome.
//
// Annotated rather than left inferred, because an inferred `vi.fn()` is
// `Mock<Procedure>` and `Procedure` lives in `@vitest/spy`, not in `vitest`.
export const getToken: Mock = vi.fn()
