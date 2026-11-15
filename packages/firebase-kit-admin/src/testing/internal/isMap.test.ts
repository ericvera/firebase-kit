import { Buffer } from 'node:buffer'
import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { isMap } from './isMap.js'

it('recognizes only plain maps', () => {
  expect(isMap({})).toBe(true)
  expect(isMap(Object.create(null))).toBe(true)
  expect(isMap([])).toBe(false)
  expect(isMap(null)).toBe(false)
  expect(isMap(Timestamp.fromMillis(0))).toBe(false)
  expect(isMap(Buffer.from('x'))).toBe(false)
})
