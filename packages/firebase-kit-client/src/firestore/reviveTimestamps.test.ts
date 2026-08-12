import { Timestamp } from 'firebase/firestore'
import { Timestamp as LiteTimestamp } from 'firebase/firestore/lite'
import { expect, it } from 'vitest'
import { FirestoreVariant } from './constants.js'
import { InvalidTimestampError } from './InvalidTimestampError.js'
import { reviveTimestamps } from './reviveTimestamps.js'

it('revives raw timestamps at any depth and leaves every other value alone', async () => {
  const result = await reviveTimestamps(
    {
      created: { seconds: 10, nanoseconds: 11 },
      name: 'an order',
      quantity: 3,
      cancelled: null,
      nested: { deep: { updated: { seconds: 20, nanoseconds: 21 } } },
      history: [
        { seconds: 30, nanoseconds: 31 },
        'a note',
        [{ seconds: 40, nanoseconds: 41 }],
      ],
    },
    FirestoreVariant.FirestoreLite,
  )

  // Verify: every `{ seconds, nanoseconds }` object becomes a Timestamp,
  // through objects, arrays and nested arrays, while strings, numbers and null
  // come back untouched
  expect(result).toMatchInlineSnapshot(`
    {
      "cancelled": null,
      "created": {
        "nanoseconds": 11,
        "seconds": 10,
        "type": "firestore/timestamp/1.0",
      },
      "history": [
        {
          "nanoseconds": 31,
          "seconds": 30,
          "type": "firestore/timestamp/1.0",
        },
        "a note",
        [
          {
            "nanoseconds": 41,
            "seconds": 40,
            "type": "firestore/timestamp/1.0",
          },
        ],
      ],
      "name": "an order",
      "nested": {
        "deep": {
          "updated": {
            "nanoseconds": 21,
            "seconds": 20,
            "type": "firestore/timestamp/1.0",
          },
        },
      },
      "quantity": 3,
    }
  `)
  expect(result.created).toBeInstanceOf(LiteTimestamp)
})

it('revives the callable-style _seconds and _nanoseconds shape', async () => {
  const result = await reviveTimestamps(
    { updated: { _seconds: 1773801652, _nanoseconds: 78000000 } },
    FirestoreVariant.FirestoreLite,
  )

  // Verify: the underscore-prefixed shape a callable response carries is
  // recognized and rebuilt with the same values
  expect(result).toMatchInlineSnapshot(`
    {
      "updated": {
        "nanoseconds": 78000000,
        "seconds": 1773801652,
        "type": "firestore/timestamp/1.0",
      },
    }
  `)
})

it('builds the full SDK timestamp for the non-lite variant', async () => {
  const result = await reviveTimestamps(
    { created: { seconds: 10, nanoseconds: 11 } },
    FirestoreVariant.Firestore,
  )

  // Verify: the variant picks the SDK whose Timestamp class is constructed —
  // the two are incompatible, so the wrong one breaks `instanceof` downstream
  expect({
    isFullSdkTimestamp: result.created instanceof Timestamp,
    isLiteSdkTimestamp: result.created instanceof LiteTimestamp,
  }).toMatchInlineSnapshot(`
    {
      "isFullSdkTimestamp": true,
      "isLiteSdkTimestamp": false,
    }
  `)
})

it('returns a value that is not an object unchanged', async () => {
  const result = await reviveTimestamps(
    'nothing to revive',
    FirestoreVariant.FirestoreLite,
  )

  // Verify: the walk stops at the first non-object rather than throwing
  expect(result).toMatchInlineSnapshot(`"nothing to revive"`)
})

it('throws a package error for a malformed timestamp', async () => {
  const result = reviveTimestamps(
    { created: { seconds: 10, nanoseconds: undefined } },
    FirestoreVariant.FirestoreLite,
  )

  // Verify: a half-built timestamp fails loudly rather than silently becoming
  // a Timestamp with an undefined field
  await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
    `[InvalidTimestampError: invalid timestamp received]`,
  )
  await expect(
    result.catch((error: unknown) => error instanceof InvalidTimestampError),
  ).resolves.toMatchInlineSnapshot(`true`)
})
