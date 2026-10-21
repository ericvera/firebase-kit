import { logger } from 'firebase-functions'
import type { HttpsError } from 'firebase-functions/https'
import type { AuthData } from 'firebase-functions/tasks'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  addSpaceToDB,
  spaceRefs,
  testDB,
  TestNonExistentID1,
  TestSpaceID1,
} from '../__test__/db/index.js'
import { setFakeTimer } from '../__test__/utils/setFakeTimer.js'
import { checkDocumentExists } from './checkDocumentExists.js'

vi.hoisted(() => {
  vi.resetModules()
})

vi.mock('firebase-functions')

const authData = { uid: 'test-uid', token: {} } as AuthData

const captureError = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('Expected rejection')
    },
    (error: unknown) => error as HttpsError,
  )

let now = 0

beforeEach(() => {
  vi.useRealTimers()
  now = setFakeTimer('2025-01-24T12:00')
})

it('throws error when document does not exist', async () => {
  const docRef = spaceRefs.doc(TestNonExistentID1)

  await expect(
    checkDocumentExists(docRef, authData),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: spaces not found: missing-id-1]`,
  )
})

it('throws error when document does not exist with transaction', async () => {
  const docRef = spaceRefs.doc(TestNonExistentID1)

  await expect(
    testDB.runTransaction(async (reader) =>
      checkDocumentExists(docRef, authData, reader),
    ),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: spaces not found: missing-id-1]`,
  )
})

it('forwards details to the error and the log when document does not exist', async () => {
  const docRef = spaceRefs.doc(TestNonExistentID1)

  const error = await captureError(
    checkDocumentExists(docRef, authData, undefined, {
      details: { step: 'after-capture' },
    }),
  )

  expect(error).toMatchInlineSnapshot(`[Error: spaces not found: missing-id-1]`)
  expect(error.code).toBe('internal')
  expect(error.details).toMatchInlineSnapshot(`
    {
      "step": "after-capture",
    }
  `)
  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[INTERNAL] spaces not found: missing-id-1 [UID: test-uid]",
      {
        "step": "after-capture",
      },
    ]
  `)
})

it('forwards details to the error when document does not exist with transaction', async () => {
  const docRef = spaceRefs.doc(TestNonExistentID1)

  const error = await captureError(
    testDB.runTransaction(async (reader) =>
      checkDocumentExists(docRef, authData, reader, {
        details: { step: 'after-capture' },
      }),
    ),
  )

  expect(error.details).toMatchInlineSnapshot(`
    {
      "step": "after-capture",
    }
  `)
})

it('leaves details undefined when no options are passed', async () => {
  const docRef = spaceRefs.doc(TestNonExistentID1)

  const error = await captureError(checkDocumentExists(docRef, authData))

  expect(error.details).toBeUndefined()
  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]?.[1]).toBeUndefined()
})

it('returns document data without logging when document exists with options', async () => {
  await addSpaceToDB(now, { name: 'Test Space Options' })
  const docRef = spaceRefs.doc(TestSpaceID1)

  const result = await checkDocumentExists(docRef, authData, undefined, {
    details: { step: 'after-capture' },
  })

  expect(result.id).toBe(TestSpaceID1)
  expect(result.name).toBe('Test Space Options')
  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})

it('returns document data with id when document exists', async () => {
  await addSpaceToDB(now, { name: 'Test Space Direct' })
  const docRef = spaceRefs.doc(TestSpaceID1)

  const result = await checkDocumentExists(docRef, authData)

  expect(result.id).toBe(TestSpaceID1)
  expect(result.name).toBe('Test Space Direct')
})

it('returns document data with id when document exists with transaction', async () => {
  await addSpaceToDB(now, { name: 'Test Space TX' })
  const docRef = spaceRefs.doc(TestSpaceID1)

  const result = await testDB.runTransaction(async (reader) =>
    checkDocumentExists(docRef, authData, reader),
  )

  expect(result.id).toBe(TestSpaceID1)
  expect(result.name).toBe('Test Space TX')
})
