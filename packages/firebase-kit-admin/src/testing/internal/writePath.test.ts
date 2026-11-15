import { Timestamp } from 'firebase-admin/firestore'
import { expect, it } from 'vitest'
import { writePath } from './writePath.js'

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
