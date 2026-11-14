import { expect, it } from 'vitest'
import type { NumberedDoc } from './getDocNumbers.js'
import { getDocNumbers } from './getDocNumbers.js'

const seeded = (path: string, content: unknown): NumberedDoc => ({
  path,
  existedBefore: true,
  content,
})

const created = (path: string, content: unknown): NumberedDoc => ({
  path,
  existedBefore: false,
  content,
})

it('numbers siblings by content, not by id', () => {
  const numbers = getDocNumbers([
    seeded('spaces/aaa', { name: 'Luis' }),
    seeded('spaces/zzz', { name: 'Ana' }),
  ])

  // Verify: the ids would order these the other way round, so a run that
  // generates different ids still numbers them the same
  expect(Object.fromEntries(numbers)).toEqual({
    'spaces/zzz': 1,
    'spaces/aaa': 2,
  })
})

it('gives the only document in a collection number 1 whatever it holds', () => {
  const before = getDocNumbers([seeded('spaces/space-1', { name: 'Ana' })])
  const after = getDocNumbers([
    seeded('spaces/space-1', { name: 'Zoe', archived: true }),
  ])

  expect(before.get('spaces/space-1')).toBe(1)
  expect(after.get('spaces/space-1')).toBe(1)
})

it('numbers each collection on its own', () => {
  const numbers = getDocNumbers([
    seeded('spaces/space-1', { name: 'Ana' }),
    seeded('spaces/space-2', { name: 'Luis' }),
    seeded('spaces/space-1/entries/entry-1', { label: 'only entry of Ana' }),
    seeded('spaces/space-2/entries/entry-2', { label: 'b' }),
    seeded('spaces/space-2/entries/entry-3', { label: 'a' }),
    seeded('people/person-1', { name: 'Zoe' }),
  ])

  // Verify: siblings are the documents under one parent, so each space's
  // entries start again at 1
  expect(Object.fromEntries(numbers)).toEqual({
    'spaces/space-1': 1,
    'spaces/space-2': 2,
    'spaces/space-1/entries/entry-1': 1,
    'spaces/space-2/entries/entry-3': 1,
    'spaces/space-2/entries/entry-2': 2,
    'people/person-1': 1,
  })
})

it('numbers documents that existed before the test ahead of new ones', () => {
  const numbers = getDocNumbers([
    seeded('spaces/seeded', { name: 'Zoe' }),
    created('spaces/created', { name: 'Ana' }),
  ])

  // Verify: by content alone the new document would take number 1 and push the
  // seeded one to 2
  expect(Object.fromEntries(numbers)).toEqual({
    'spaces/seeded': 1,
    'spaces/created': 2,
  })
})

it('gives siblings with identical content the same number', () => {
  const numbers = getDocNumbers([
    seeded('spaces/space-1', { name: 'Same' }),
    seeded('spaces/space-2', { name: 'Same' }),
    seeded('spaces/space-3', { name: 'Tail' }),
  ])

  // Verify: which twin came first could only be decided by id, which changes
  // between runs
  expect(Object.fromEntries(numbers)).toEqual({
    'spaces/space-1': 1,
    'spaces/space-2': 1,
    'spaces/space-3': 2,
  })
})

it('ranks the same data alike whatever order its fields were written in', () => {
  const numbers = getDocNumbers([
    seeded('spaces/space-1', { name: 'Same', meta: { a: 1, b: [1, 2] } }),
    seeded('spaces/space-2', { meta: { b: [1, 2], a: 1 }, name: 'Same' }),
  ])

  expect(Object.fromEntries(numbers)).toEqual({
    'spaces/space-1': 1,
    'spaces/space-2': 1,
  })
})

it('tells apart values that differ only in type', () => {
  const numbers = getDocNumbers([
    seeded('spaces/space-1', { count: '1' }),
    seeded('spaces/space-2', { count: 1 }),
    seeded('spaces/space-3', { count: null }),
  ])

  expect(new Set(numbers.values()).size).toBe(3)
})
