import { type Mock, vi } from 'vitest'

const actual =
  await vi.importActual<typeof import('firebase/functions')>(
    'firebase/functions',
  )

// Wrapped rather than replaced, so each case still gets the shipped instance
// resolution while the spy records whether the lazy lookup ran.
//
// Annotated rather than left inferred, because an inferred `vi.fn()` is
// `Mock<Procedure>` and `Procedure` lives in `@vitest/spy`, not in `vitest`.
export const getFunctions: Mock<typeof actual.getFunctions> = vi.fn(
  actual.getFunctions,
)

// Wrapped rather than replaced too, so a suite that records the callables it
// builds swaps its own implementation in while the rest keep the shipped one.
export const httpsCallable: Mock<typeof actual.httpsCallable> = vi.fn(
  actual.httpsCallable,
)

// Untouched, because only the instance lookup and the callable factory need
// observing.
export const {
  FunctionsError,
  connectFunctionsEmulator,
  httpsCallableFromURL,
} = actual
