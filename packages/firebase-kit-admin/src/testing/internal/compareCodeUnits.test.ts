import { expect, it } from 'vitest'
import { compareCodeUnits } from './compareCodeUnits.js'

it('orders strings by code unit', () => {
  const names = ['order-location', 'order', 'Order', 'business']

  names.sort(compareCodeUnits)

  // Verify: uppercase sorts ahead of lowercase and a prefix ahead of the longer
  // name, which a locale-aware comparison would not guarantee
  expect(names).toEqual(['Order', 'business', 'order', 'order-location'])
})

it('reports equal strings as equal', () => {
  expect(compareCodeUnits('order', 'order')).toBe(0)
})
