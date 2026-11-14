import { Buffer } from 'node:buffer'
import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { isMap, readPath, writePath } from './maskPath.js'

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

it('writes a nested leaf without touching the original nested map', () => {
  const at = Timestamp.fromMillis(1000)
  const meta = { at, keep: 'x' }
  const data: Record<string, unknown> = { meta }

  writePath(data, 'meta.at', '/Timestamp/')

  // Verify: the written map is a copy, so the caller's map keeps its value
  expect(data).toEqual({ meta: { at: '/Timestamp/', keep: 'x' } })
  expect(data['meta']).not.toBe(meta)
  expect(meta).toEqual({ at, keep: 'x' })
  expect(meta.at).toBe(at)
})

it('recognizes only plain maps', () => {
  expect(isMap({})).toBe(true)
  expect(isMap(Object.create(null))).toBe(true)
  expect(isMap([])).toBe(false)
  expect(isMap(null)).toBe(false)
  expect(isMap(Timestamp.fromMillis(0))).toBe(false)
  expect(isMap(Buffer.from('x'))).toBe(false)
})
