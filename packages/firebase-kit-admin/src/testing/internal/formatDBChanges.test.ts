import { expect, it } from 'vitest'
import { createDBSnapshot } from '../../__test__/utils/createDBSnapshot.js'
import { createDocSnapshot } from '../../__test__/utils/createDocSnapshot.js'
import { formatDBChanges } from './formatDBChanges.js'
import { getDBChanges } from './getDBChanges.js'

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
    createDBSnapshot([stable, changedBefore, goneDoc]),
    createDBSnapshot([stable, changedAfter, newDoc]),
  )

  // Verify: the `DB DIFF` header, one headed section per added, removed and
  // modified document with its normalized path, and no section for the
  // unmodified one
  expect(formatDBChanges(changes)).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     MODIFIED (path: entries/[ID])
    --------------------------------
      Object {
    -   "name": "before",
    +   "name": "after",
      }
    --------------------------------

    --------------------------------
     ADDED (path: spaces/[ID])
    --------------------------------
    + Object {
    +   "name": "new",
    + }
    --------------------------------

    --------------------------------
     REMOVED (path: spaces/[ID])
    --------------------------------
    -   "name": "gone",
    - }
    + Object {}"
  `)
})

it('renders a body for a document whose only change is masked', () => {
  const before = createDoc(
    'entries/entry-1',
    { name: 'Draft', secret: 'a' },
    1000,
  )
  const after = createDoc(
    'entries/entry-1',
    { name: 'Draft', secret: 'b' },
    2000,
  )

  const changes = getDBChanges(
    createDBSnapshot([before]),
    createDBSnapshot([after]),
    { entries: ['secret'] },
  )

  // Verify: the masked change prints as a labelled pair rather than leaving the
  // MODIFIED section empty
  expect(formatDBChanges(changes)).toMatchInlineSnapshot(`
    "DB DIFF

    --------------------------------
     MODIFIED (path: entries/[ID])
    --------------------------------
      Object {
        "name": "Draft",
    -   "secret": "/String (before)/",
    +   "secret": "/String (after)/",
      }"
  `)
})

it('renders just the header when nothing changed', () => {
  const stable = createDoc('entries/stable', { name: 'stable' }, 1000)

  const changes = getDBChanges(
    createDBSnapshot([stable]),
    createDBSnapshot([stable]),
  )

  expect(formatDBChanges(changes)).toMatchInlineSnapshot(`
    "DB DIFF

    "
  `)
})

it('drops the leading line of an added or removed diff', () => {
  const goneDoc = createDoc('entries/gone', { name: 'gone' }, 1000)

  const changes = getDBChanges(
    createDBSnapshot([goneDoc]),
    createDBSnapshot([]),
  )
  const [removed] = changes.removed
  const rawDiff = removed?.getDiff() ?? ''

  // Verify: the raw diff opens with the bare `Object {` marker, which carries
  // no information once the section header already names the document
  expect(rawDiff.split('\n').slice(0, 1)).toMatchInlineSnapshot(`
    [
      "- Object {",
    ]
  `)
  expect(formatDBChanges(changes)).not.toContain(
    `${rawDiff.split('\n')[0] ?? ''}\n`,
  )
})

it('orders the sections so the output is stable across runs', () => {
  const first = createDoc('entries/first', { name: 'first' }, 1000)
  const second = createDoc('spaces/second', { name: 'second' }, 2000)

  const changes = getDBChanges(
    createDBSnapshot([]),
    createDBSnapshot([first, second]),
  )
  const inOrder = formatDBChanges(changes)

  changes.added.reverse()

  // Verify: sections are sorted before joining, so the order documents happened
  // to be read in cannot churn a snapshot
  expect(formatDBChanges(changes)).toEqual(inOrder)
})

const toHeaders = (text: string): string[] =>
  text.split('\n').filter((line) => /^ (ADDED|MODIFIED|REMOVED) /.test(line))

it('puts each document directly above the documents in its subcollections', () => {
  const ana = createDoc('spaces/space-a', { name: 'Ana' }, 1000)
  const luisBefore = createDoc('spaces/space-b', { name: 'Luis' }, 1000)
  const luisAfter = createDoc('spaces/space-b', { name: 'Luis M.' }, 2000)
  const person = createDoc('people/person-1', { name: 'Zoe' }, 2000)
  const anaEntry = createDoc('spaces/space-a/entries/entry-1', { n: 1 }, 2000)
  const luisEntry = createDoc('spaces/space-b/entries/entry-2', { n: 2 }, 2000)
  const luisGone = createDoc('spaces/space-b/entries/entry-3', { n: 3 }, 1000)

  const changes = getDBChanges(
    createDBSnapshot([ana, luisBefore, luisGone]),
    createDBSnapshot([ana, luisAfter, person, anaEntry, luisEntry]),
  )

  // Verify: sections sort by path before kind, so the modified space sits
  // right above its own added and removed entries instead of every addition
  // coming first. The unmodified space has no section, and its number alone
  // says which space the first entry went to
  expect(toHeaders(formatDBChanges(changes))).toEqual([
    ' ADDED (path: people/[ID])',
    ' ADDED (path: spaces/[ID 1]/entries/[ID])',
    ' MODIFIED (path: spaces/[ID 2])',
    ' ADDED (path: spaces/[ID 2]/entries/[ID])',
    ' REMOVED (path: spaces/[ID 2]/entries/[ID])',
  ])
})

it('keeps a collection apart from one whose name starts the same', () => {
  const order = createDoc('order/order-1', { n: 1 }, 1000)
  const turn = createDoc('order/order-1/turns/turn-1', { n: 1 }, 1000)
  const location = createDoc('order-location/location-1', { n: 1 }, 1000)

  const changes = getDBChanges(
    createDBSnapshot([]),
    createDBSnapshot([location, turn, order]),
  )

  // Verify: names compare whole, so the order and its turns stay together. A
  // sort over the rendered text puts `order-location` first, because `-` sorts
  // ahead of the `/` that ends `order`
  expect(toHeaders(formatDBChanges(changes))).toEqual([
    ' ADDED (path: order/[ID 1])',
    ' ADDED (path: order/[ID 1]/turns/[ID])',
    ' ADDED (path: order-location/[ID])',
  ])
})
