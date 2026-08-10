import type { Query } from 'firebase/firestore/lite'
import { expect, it, vi } from 'vitest'
import { fetchDocs } from './fetchDocs.js'

const state = vi.hoisted(() => ({
  /** Every query the SDK was handed, in call order. */
  queriedWith: [] as unknown[],
}))

vi.mock('firebase/firestore/lite', () => ({
  getDocs: (query: unknown) => {
    state.queriedWith.push(query)

    return Promise.resolve({ docs: [] })
  },
}))

const createQuery = (name: string) => ({ name }) as unknown as Query

it('awaits the query builder before handing the query to the SDK', async () => {
  state.queriedWith = []

  const query = createQuery('entries')

  const result = await fetchDocs({ getQuery: () => Promise.resolve(query) })

  // Verify: the resolved query reaches getDocs — not the promise wrapping it —
  // and the snapshot comes straight back
  expect(state.queriedWith).toEqual([query])
  expect(result).toMatchInlineSnapshot(`
    {
      "docs": [],
    }
  `)
})

it('propagates a failure from the query builder without calling the SDK', async () => {
  state.queriedWith = []

  const failing = fetchDocs({
    getQuery: () => Promise.reject(new Error('ref build failed')),
  })

  // Verify: a ref that cannot be built surfaces as-is, and no query is issued
  await expect(failing).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: ref build failed]`,
  )
  expect(state.queriedWith).toEqual([])
})
