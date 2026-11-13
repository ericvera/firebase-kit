import type { Query, QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { expect, it, vi } from 'vitest'
import { createDocSnapshot } from '../__test__/utils/createDocSnapshot.js'
import { expectNoDBChanges } from './expectNoDBChanges.js'
import { getDBSnapshot } from './getDBSnapshot.js'

const createMutableQuery = (initial: QueryDocumentSnapshot[]) => {
  const state = { docs: initial }
  const query = { get: () => ({ docs: state.docs }) } as unknown as Query

  return { state, query }
}

const createSpace = (
  id: string,
  data: Record<string, unknown>,
  updateTimeMs: number,
) => createDocSnapshot({ path: `spaces/${id}`, data, updateTimeMs })

it('resolves when nothing changed', async () => {
  const { state, query } = createMutableQuery([
    createSpace('space-1', { name: 'Same' }, 1),
  ])
  const before = await getDBSnapshot(query)
  state.docs = [createSpace('space-1', { name: 'Same' }, 1)]

  await expect(expectNoDBChanges(before)).resolves.toBeUndefined()
})

it('resolves when data changed but updateTime did not', async () => {
  const { state, query } = createMutableQuery([
    createSpace('space-1', { name: 'Old' }, 1),
  ])
  const before = await getDBSnapshot(query)
  state.docs = [createSpace('space-1', { name: 'New' }, 1)]

  // Verify: a document counts as modified only when its updateTime moved, the
  // same rule the diff uses
  await expect(expectNoDBChanges(before)).resolves.toBeUndefined()
})

it('rejects with the diff when a document was added', async () => {
  const { state, query } = createMutableQuery([])
  const before = await getDBSnapshot(query)
  state.docs = [createSpace('space-1', { name: 'Added' }, 2)]

  // Verify: the message leads with the failure line and carries the whole
  // DB DIFF text
  await expect(expectNoDBChanges(before)).rejects
    .toThrowErrorMatchingInlineSnapshot(`
    [Error: Expected no DB changes, found:

    DB DIFF

    --------------------------------
     ADDED (path: spaces/[ID])
    --------------------------------
    + Object {
    +   "name": "Added",
    + }]
  `)
})

it('rejects with the diff when a document was removed', async () => {
  const { state, query } = createMutableQuery([
    createSpace('space-1', { name: 'Gone' }, 1),
  ])
  const before = await getDBSnapshot(query)
  state.docs = []

  await expect(expectNoDBChanges(before)).rejects.toThrow(
    'REMOVED (path: spaces/[ID])',
  )
})

it('rejects with the diff when a document was modified', async () => {
  const { state, query } = createMutableQuery([
    createSpace('space-1', { name: 'Old' }, 1),
  ])
  const before = await getDBSnapshot(query)
  state.docs = [createSpace('space-1', { name: 'New' }, 2)]

  await expect(expectNoDBChanges(before)).rejects.toThrow(
    'MODIFIED (path: spaces/[ID])',
  )
})

it('rejects for a rewrite with identical data', async () => {
  const { state, query } = createMutableQuery([
    createSpace('space-1', { name: 'Same' }, 1),
  ])
  const before = await getDBSnapshot(query)
  state.docs = [createSpace('space-1', { name: 'Same' }, 2)]

  // Verify: a newer updateTime alone fails the assertion even though no field
  // differs
  await expect(expectNoDBChanges(before)).rejects.toThrow('MODIFIED (path: ')
})

it('re-reads every input, refs object and bare query', async () => {
  const refs = createMutableQuery([])
  const bare = createMutableQuery([])
  const refsGet = vi.spyOn(refs.query, 'get')
  const bareGet = vi.spyOn(bare.query, 'get')

  const before = await getDBSnapshot([
    { testAllQuery: () => refs.query },
    bare.query,
  ])

  await expectNoDBChanges(before)

  expect(refsGet).toHaveBeenCalledTimes(2)
  expect(bareGet).toHaveBeenCalledTimes(2)
})
