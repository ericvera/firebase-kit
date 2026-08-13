import { expect, it } from 'vitest'
import { maskProps } from './maskProps.js'

it('replaces a masked string with the string type token', () => {
  const data = { token: 'super-secret', keep: 'visible' }

  const result = maskProps(data, 'entries', { entries: ['token'] })

  // Verify: the masked key loses its value but keeps its type, and unlisted
  // keys pass through untouched
  expect(result).toEqual({ token: '/String/', keep: 'visible' })
})

it('renders a type token per value type rather than passing non-strings through', () => {
  const data = {
    text: 'value',
    count: 7,
    flag: true,
    empty: null,
    list: [1, 2],
    map: { nested: true },
  }

  const result = maskProps(data, 'entries', {
    entries: ['text', 'count', 'flag', 'empty', 'list', 'map'],
  })

  // Verify: every masked value becomes its own token, so a mask still tells the
  // reader what shape the field had
  expect(result).toEqual({
    text: '/String/',
    count: '/Number/',
    flag: '/Boolean/',
    empty: '/Null/',
    list: '/Array/',
    map: '/Map/',
  })
})

it('masks nothing when the collection has no mask entry', () => {
  const data = { token: 'super-secret' }

  const result = maskProps(data, 'spaces', { entries: ['token'] })

  // Verify: masks are keyed by collection, so a different collection is
  // untouched — this is also what makes an empty mask object a no-op
  expect(result).toEqual({ token: 'super-secret' })
})

it('leaves a masked key that is absent from the value alone', () => {
  const data = { keep: 'visible' }

  const result = maskProps(data, 'entries', { entries: ['missing'] })

  // Verify: masking never introduces a key that the document did not have
  expect(result).toEqual({ keep: 'visible' })
})

it('returns non-object values unchanged', () => {
  const maskKeys = { entries: ['0'] }

  // Verify: arrays, null and primitives have no top-level props to mask
  expect(maskProps(['a'], 'entries', maskKeys)).toEqual(['a'])
  expect(maskProps(null, 'entries', maskKeys)).toEqual(null)
  expect(maskProps('plain', 'entries', maskKeys)).toEqual('plain')
})

it('masks in place, returning the object it was handed', () => {
  const data = { token: 'super-secret' }

  const result = maskProps(data, 'entries', { entries: ['token'] })

  // Verify: this mutates its input — safe in production because it only ever
  // sees freshly normalized data, but a shared fixture would leak between cases
  expect(result).toBe(data)
  expect(data).toEqual({ token: '/String/' })
})
