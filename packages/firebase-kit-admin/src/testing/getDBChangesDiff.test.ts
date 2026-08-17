import { expect, it } from 'vitest'
import { createDocSnapshot } from '../__test__/utils/createDocSnapshot.js'
import { getDBChanges } from './getDBChanges.js'
import { getDBChangesDiff } from './getDBChangesDiff.js'

const createDoc = (
  path: string,
  data: Record<string, unknown>,
  updateTimeMs: number,
) => createDocSnapshot({ path, data, updateTimeMs })

it('renders the envelope with a section per change', () => {
  const stable = createDoc('entries/stable', { name: 'stable' }, 1000)
  const changedBefore = createDoc('entries/changed', { name: 'before' }, 1000)
  const changedAfter = createDoc('entries/changed', { name: 'after' }, 2000)
  const goneDoc = createDoc('spaces/gone', { name: 'gone' }, 1000)
  const newDoc = createDoc('spaces/new', { name: 'new' }, 3000)

  const changes = getDBChanges(
    [stable, changedBefore, goneDoc],
    [stable, changedAfter, newDoc],
  )

  // Verify: the `DB DIFF` header, one headed section per added, removed and
  // modified document with its normalized path, and no section for the
  // unmodified one
  expect(getDBChangesDiff(changes)).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     ADDED (path: spaces/[ID])
    --------------------------------
    + Object {
    +   "name": "new",
    + }
    --------------------------------

    --------------------------------
     MODIFIED (path: entries/[ID])
    --------------------------------
      Object {
    -   "name": "before",
    +   "name": "after",
      }
    --------------------------------

    --------------------------------
     REMOVED (path: spaces/[ID])
    --------------------------------
    -   "name": "gone",
    - }
    + Object {}"
  `)
})

it('renders just the header when nothing changed', () => {
  const stable = createDoc('entries/stable', { name: 'stable' }, 1000)

  const changes = getDBChanges([stable], [stable])

  expect(getDBChangesDiff(changes)).toMatchInlineSnapshot(`
    "DB DIFF

    "
  `)
})

it('drops the leading line of an added or removed diff', () => {
  const goneDoc = createDoc('entries/gone', { name: 'gone' }, 1000)

  const changes = getDBChanges([goneDoc], [])
  const [removed] = changes.removed
  const rawDiff = removed?.getDiff() ?? ''

  // Verify: the raw diff opens with the bare `Object {` marker, which carries
  // no information once the section header already names the document
  expect(rawDiff.split('\n').slice(0, 1)).toMatchInlineSnapshot(`
    [
      "- Object {",
    ]
  `)
  expect(getDBChangesDiff(changes)).not.toContain(
    `${rawDiff.split('\n')[0] ?? ''}\n`,
  )
})

it('orders the sections so the output is stable across runs', () => {
  const first = createDoc('entries/first', { name: 'first' }, 1000)
  const second = createDoc('spaces/second', { name: 'second' }, 2000)

  const changes = getDBChanges([], [first, second])
  const inOrder = getDBChangesDiff(changes)

  changes.added.reverse()

  // Verify: sections are sorted before joining, so the order documents happened
  // to be read in cannot churn a snapshot
  expect(getDBChangesDiff(changes)).toEqual(inOrder)
})
