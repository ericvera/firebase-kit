import { afterEach, expect, it, vi } from 'vitest'
import { createGetTestProjectId } from './createGetTestProjectId.js'

const Seed = 'file:///checkout/a/setup.ts'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('derives a project id from the base and the isolation seed', () => {
  // Pinned, because the real one is whichever vitest worker picked this file
  // up — leaving it would make every project-id snapshot depend on that.
  vi.stubEnv('VITEST_POOL_ID', '')

  const getTestProjectId = createGetTestProjectId('demo-tests', Seed)

  // Verify: the seed is hashed rather than used directly, so the id stays short
  // and free of characters Firebase rejects whatever the app passed
  expect(getTestProjectId()).toMatchInlineSnapshot(`"demo-tests-5248fc25"`)
})

it('gives two checkouts distinct project ids', () => {
  vi.stubEnv('VITEST_POOL_ID', '')

  const first = createGetTestProjectId('demo-tests', Seed)
  const second = createGetTestProjectId(
    'demo-tests',
    'file:///checkout/b/setup.ts',
  )

  // Verify: two checkouts pointed at one emulator do not wipe each other's
  // seeded data
  expect(first()).not.toEqual(second())
})

it('appends the vitest worker id so parallel workers stay separated', () => {
  vi.stubEnv('VITEST_POOL_ID', '3')

  const getTestProjectId = createGetTestProjectId('demo-tests', Seed)

  // Verify: without this suffix two workers share a project and the per-file
  // reset wipes data the other worker just seeded
  expect(getTestProjectId()).toMatchInlineSnapshot(`"demo-tests-5248fc253"`)
})
