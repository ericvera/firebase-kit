import { createStore, setMeta } from 'getsetdel'
import { expect, it } from 'vitest'
import { FirestoreVariant } from '../constants.js'
import { getMetadata } from './getMetadata.js'

// No `getsetdel` mock: the setup file installs an in-memory IndexedDB, so the
// real store runs and the assertions read what was actually written.
// A fresh store per case, so one case's metadata cannot leak into the next.
let storeCount = 0

const createTestStore = () => {
  storeCount += 1

  return createStore({ name: `entries-${String(storeCount)}`, version: 1 })
}

it('revives the stored metadata before returning it', async () => {
  const storeToken = await createTestStore()

  await setMeta(storeToken, { latestUpdated: { seconds: 10, nanoseconds: 0 } })

  const result = await getMetadata(storeToken, FirestoreVariant.Firestore)

  // Verify: the plain `{ seconds, nanoseconds }` the store holds comes back as
  // a real Timestamp — the `type` marker is the SDK's own serialization — so
  // it compares against the timestamps on incoming documents
  expect(result).toMatchInlineSnapshot(`
    {
      "latestUpdated": {
        "nanoseconds": 0,
        "seconds": 10,
        "type": "firestore/timestamp/1.0",
      },
    }
  `)
})

it('returns undefined without reviving when the store holds no metadata', async () => {
  const storeToken = await createTestStore()

  const result = await getMetadata(storeToken, FirestoreVariant.FirestoreLite)

  // Verify: an empty store reads as undefined rather than as a revived empty
  // object, so the caller treats the cache as uninitialized
  expect(result).toBeUndefined()
})
