import { expect, it } from 'vitest'
import { createFirebaseAdminAuthMock } from './createFirebaseAdminAuthMock.js'

it('serves back a user the test seeded', async () => {
  const mock = createFirebaseAdminAuthMock()

  mock.setUser({ uid: 'user-1', customClaims: { v: 3 } })

  // Verify: the in-memory directory is what a caller's claims lookup reads,
  // instead of Firebase Auth
  expect(await mock.getAuth().getUser('user-1')).toMatchInlineSnapshot(`
    {
      "customClaims": {
        "v": 3,
      },
      "uid": "user-1",
    }
  `)
})

it('rejects an unseeded uid the way the SDK does', async () => {
  const mock = createFirebaseAdminAuthMock()

  // Verify: the not-found path is reachable without a second double
  await expect(
    mock.getAuth().getUser('missing'),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: There is no user record for uid missing]`,
  )
})

it('seeds through setCustomUserClaims as well', async () => {
  const mock = createFirebaseAdminAuthMock()

  await mock.getAuth().setCustomUserClaims('user-1', { v: 4 })

  // Verify: a suite that cannot reach the shim's own exports can still seed the
  // directory through a real Auth method
  expect((await mock.getAuth().getUser('user-1')).customClaims)
    .toMatchInlineSnapshot(`
      {
        "v": 4,
      }
    `)
})

it('clears claims when setCustomUserClaims is given null', async () => {
  const mock = createFirebaseAdminAuthMock()

  mock.setUser({ uid: 'user-1', customClaims: { v: 3 } })

  await mock.getAuth().setCustomUserClaims('user-1', null)

  // Verify: null is how the real SDK removes claims, so a caller testing the
  // no-claims path gets the same shape back
  expect((await mock.getAuth().getUser('user-1')).customClaims).toBeUndefined()
})

it('records every uid that was looked up', async () => {
  const mock = createFirebaseAdminAuthMock()

  mock.setUser({ uid: 'user-1' })

  await mock.getAuth().getUser('user-1')
  await expect(mock.getAuth().getUser('missing')).rejects.toThrow()

  // Verify: a failed lookup is recorded too, so a caller asserting which uid it
  // asked for is not misled by the rejection
  expect(mock.getRequestedUids()).toEqual(['user-1', 'missing'])
})

it('empties the directory and the lookup log on reset', async () => {
  const mock = createFirebaseAdminAuthMock()

  mock.setUser({ uid: 'user-1' })

  await mock.getAuth().getUser('user-1')

  mock.resetFirebaseAdminAuthMock()

  // Verify: one test's seeded users cannot satisfy the next test's lookup
  await expect(mock.getAuth().getUser('user-1')).rejects.toThrow()
  expect(mock.getRequestedUids()).toEqual(['user-1'])
})
