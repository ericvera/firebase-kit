import { expect, it } from 'vitest'
import { createTestFirestoreDependencies } from '../__test__/utils/createTestFirestoreDependencies.js'
import { createFirestoreUtils } from './createFirestoreUtils.js'
import type { FirestoreUtilsDependencies } from './types.js'

const createDependencies = (): FirestoreUtilsDependencies =>
  createTestFirestoreDependencies({
    cacheVersion: 8,
  })

it('hands back the whole access layer already bound', () => {
  const utils = createFirestoreUtils(createDependencies())

  // Verify: every utility an app's db barrel exposes is present, so a
  // missing one fails here rather than at the app's import site
  expect(Object.keys(utils).sort()).toMatchInlineSnapshot(`
    [
      "getDoc",
      "getDocWithCache",
      "getDocs",
      "getDocsWithCache",
      "getDocsWithCursor",
      "getHostingFirestore",
      "readThroughCache",
      "subscribe",
      "subscribeWithCache",
    ]
  `)
})

it('binds every utility to the dependencies it was given', () => {
  const utils = createFirestoreUtils(createDependencies())

  // Verify: each entry is callable — a factory that forgot to invoke one of its
  // create* helpers would leave a factory here instead of a bound function
  expect(
    Object.values(utils).every((value) => typeof value === 'function'),
  ).toEqual(true)
})

it('gives each bind its own instances', () => {
  const first = createFirestoreUtils(createDependencies())
  const second = createFirestoreUtils(createDependencies())

  // Verify: two apps (or an app and its tests) binding separately do not share
  // closures, so one's database id cannot leak into the other's reads
  expect(first.getDoc).not.toBe(second.getDoc)
})
