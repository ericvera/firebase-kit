import { Buffer } from 'node:buffer'
import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { readPath } from './readPath.js'

it('reads a top-level value', () => {
  expect(readPath({ a: 1 }, 'a')).toBe(1)
})

it('reads a nested value', () => {
  expect(readPath({ a: { b: { c: 'leaf' } } }, 'a.b.c')).toBe('leaf')
})

it('returns undefined when an intermediate is missing', () => {
  expect(readPath({ a: {} }, 'a.b.c')).toBeUndefined()
  expect(readPath({}, 'a.b')).toBeUndefined()
})

it('returns undefined when an intermediate is not a map', () => {
  // Verify: a path never indexes into an array or enters a class instance
  expect(readPath({ a: [{ b: 1 }] }, 'a.0')).toBeUndefined()
  expect(readPath({ a: Timestamp.fromMillis(1000) }, 'a.seconds')).toBe(
    undefined,
  )
  expect(readPath({ a: Buffer.from('x') }, 'a.length')).toBeUndefined()
  expect(readPath({ a: 'text' }, 'a.length')).toBeUndefined()
})
