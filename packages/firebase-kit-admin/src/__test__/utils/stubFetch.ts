import { vi } from 'vitest'

/** One call the stub recorded, in the shape the emulator tests assert on. */
interface StubbedRequest {
  url: string
  method: string | undefined
}

/**
 * Replaces global `fetch` with a recorder, for the emulator helpers that reach
 * the emulator's REST surface rather than the Admin SDK.
 *
 * Returns the array it records into — assert on it directly — plus a setter,
 * because a test that exercises the unreachable-emulator path has to change the
 * outcome after `beforeEach` has already installed the stub. An undefined
 * status rejects, which is what a refused connection looks like from `fetch`.
 *
 * The caller still owns teardown: `vi.unstubAllGlobals()` in its own
 * `afterEach`.
 */
export const stubFetch = (initialStatus: number | undefined = 200) => {
  const requests: StubbedRequest[] = []

  let status: number | undefined = initialStatus

  vi.stubGlobal('fetch', (url: string, init?: { method?: string }) => {
    requests.push({ url, method: init?.method })

    if (status === undefined) {
      return Promise.reject(new Error('connection refused'))
    }

    return Promise.resolve({ status })
  })

  return {
    requests,
    /** Status later calls resolve with; undefined makes them reject. */
    setStatus: (next: number | undefined) => {
      status = next
    },
  }
}
