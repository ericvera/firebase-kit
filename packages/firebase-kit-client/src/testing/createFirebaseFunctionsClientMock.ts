import { FirebaseError } from 'firebase/app'
import type { HttpsCallableStreamResult } from 'firebase/functions'
import { vi } from 'vitest'

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase/functions` module, so a bare
 * `vi.mock('firebase/functions')` echoes the request payload back instead of
 * calling a deployed function. A payload carrying `throwInternal` or
 * `throwFirebaseError` makes the call reject, which is how caller tests drive
 * their error paths.
 */
export const createFirebaseFunctionsClientMock = () => {
  const getFunctions = vi.fn()

  // Mock implementation for httpsCallable
  const createCallableMock = <
    RequestData = unknown,
    ResponseData = unknown,
  >() => {
    // Returns rejected promises rather than throwing from an `async` body, so
    // every failure path stays asynchronous exactly as the real SDK's is.
    const callable = (data: RequestData) => {
      if (typeof data !== 'object' || data === null) {
        return Promise.reject(
          new FirebaseError(
            'functions/invalid-argument',
            'Data must be an object',
          ),
        )
      }

      if ('throwInternal' in data) {
        return Promise.reject(
          new FirebaseError('functions-exp/internal', 'Internal error message'),
        )
      }

      if ('throwFirebaseError' in data) {
        // A non-connectivity firebase error: it must NOT be a code that
        // withConnectivityHandling probes (e.g. deadline-exceeded), so the
        // caller's generic-wrapping path is what gets exercised here.
        return Promise.reject(
          new FirebaseError(
            'functions/permission-denied',
            'Firebase error message',
          ),
        )
      }

      return Promise.resolve({ data })
    }

    callable.stream = (data: RequestData) =>
      Promise.resolve({
        data,
        stream: null as unknown as AsyncIterable<unknown>,
      } as HttpsCallableStreamResult<ResponseData>)

    return callable
  }

  const httpsCallable = vi.fn(createCallableMock)

  // Function to reset internal state and reinitialize the mocks
  const resetFunctionsMocks = () => {
    // First clear the mock
    vi.mocked(httpsCallable).mockClear()

    // Then reinitialize it with the proper implementation
    vi.mocked(httpsCallable).mockImplementation(createCallableMock)
  }

  return { getFunctions, httpsCallable, resetFunctionsMocks }
}
