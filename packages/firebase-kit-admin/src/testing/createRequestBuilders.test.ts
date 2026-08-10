import type { AuthData } from 'firebase-functions/tasks'
import { expect, it } from 'vitest'
import { createRequestBuilders } from './createRequestBuilders.js'

const builders = createRequestBuilders({
  apiVersion: 7,
  appUrl: 'https://app.example.com',
})

const authData = { uid: 'some-uid', token: {} } as AuthData

it('stamps the bound API version onto handler request data', () => {
  const result = builders.createHandlerRequestData({ entryId: 'entry-1' })

  // Verify: the bound version is added, so a handler test exercises the same
  // envelope the client sends
  expect(result).toMatchInlineSnapshot(`
    {
      "entryId": "entry-1",
      "v": 7,
    }
  `)
})

it('builds an authenticated callable request with the bound origin', () => {
  const result = builders.createCallableRequest(
    { entryId: 'entry-1' },
    authData,
  )

  // Verify: the version is stamped, the origin header is the bound app URL, and
  // the auth the caller passed is attached
  expect(result).toMatchInlineSnapshot(`
    {
      "acceptsStreaming": false,
      "auth": {
        "token": {},
        "uid": "some-uid",
      },
      "data": {
        "entryId": "entry-1",
        "v": 7,
      },
      "rawRequest": {
        "headers": {
          "origin": "https://app.example.com",
        },
      },
    }
  `)
})

it('omits auth entirely for an unauthenticated callable request', () => {
  const result = builders.createCallableRequest(
    { entryId: 'entry-1' },
    undefined,
  )

  // Verify: the key is absent rather than present-and-undefined — the property
  // has no `undefined` in its type, and either shape reads back the same
  expect('auth' in result).toEqual(false)
})
