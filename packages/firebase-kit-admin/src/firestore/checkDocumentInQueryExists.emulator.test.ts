import { logger } from 'firebase-functions'
import type { HttpsError } from 'firebase-functions/https'
import type { AuthData } from 'firebase-functions/tasks'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  addPersonToDB,
  personRefs,
  testDB,
  TestPersonID1,
  TestPersonID2,
} from '../__test__/db/index.js'
import { setFakeTimer } from '../__test__/utils/setFakeTimer.js'
import { normalizeData } from '../testing/normalizeData.js'
import { checkDocumentInQueryExists } from './checkDocumentInQueryExists.js'

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
  now = setFakeTimer('2025-01-01T12:00')
})

it('throws with custom message when query is empty and errorIfEmpty is provided', async () => {
  const query = personRefs.personByHandleQuery('nonexistent')

  await expect(
    checkDocumentInQueryExists(query, {
      auth: authData,
      errorIfEmpty: 'Person not found for handle nonexistent',
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Person not found for handle nonexistent]`,
  )
})

it('throws with default message when query has multiple results', async () => {
  await addPersonToDB(now, {
    id: TestPersonID1,
    handle: 'duplicate',
    displayName: 'Person 1',
  })
  await addPersonToDB(now, {
    id: TestPersonID2,
    handle: 'duplicate',
    displayName: 'Person 2',
  })

  const query = personRefs.personByHandleQuery('duplicate')

  await expect(
    checkDocumentInQueryExists(query, {
      auth: authData,
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Expected at most 1 document in query, found 2]`,
  )
})

it('throws with custom message when query has multiple results and errorIfMultiple is provided', async () => {
  await addPersonToDB(now, {
    id: TestPersonID1,
    handle: 'duplicate2',
    displayName: 'Person 1',
  })
  await addPersonToDB(now, {
    id: TestPersonID2,
    handle: 'duplicate2',
    displayName: 'Person 2',
  })

  const query = personRefs.personByHandleQuery('duplicate2')

  await expect(
    checkDocumentInQueryExists(query, {
      auth: authData,
      errorIfMultiple: 'Multiple People found for handle duplicate2',
    }),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Multiple People found for handle duplicate2]`,
  )
})

it('throws when query has multiple results with transaction', async () => {
  await addPersonToDB(now, {
    id: TestPersonID1,
    handle: 'duplicatetx',
    displayName: 'Person 1',
  })
  await addPersonToDB(now, {
    id: TestPersonID2,
    handle: 'duplicatetx',
    displayName: 'Person 2',
  })

  const query = personRefs.personByHandleQuery('duplicatetx')

  await expect(
    testDB.runTransaction(async (reader) =>
      checkDocumentInQueryExists(query, {
        auth: authData,
        reader,
      }),
    ),
  ).rejects.toThrowErrorMatchingInlineSnapshot(
    `[Error: Expected at most 1 document in query, found 2]`,
  )
})

it('returns undefined when query is empty and errorIfEmpty is not provided', async () => {
  const query = personRefs.personByHandleQuery('nonexistent')

  const result = await checkDocumentInQueryExists(query, {
    auth: authData,
  })

  expect(result).toBeUndefined()
})

it('returns document data when query has exactly one result', async () => {
  await addPersonToDB(now, {
    handle: 'testhandle',
    displayName: 'Test Person',
  })

  const query = personRefs.personByHandleQuery('testhandle')

  const result = await checkDocumentInQueryExists(query, {
    auth: authData,
  })

  expect(normalizeData(result)).toMatchInlineSnapshot(`
    {
      "created": "/Timestamp 0000/",
      "displayName": "Test Person",
      "handle": "testhandle",
      "id": "person-id-1",
      "stats": {
        "active": 0,
        "archived": 0,
      },
      "updated": "/Timestamp 0000/",
      "v": 1,
    }
  `)
})

it('returns document data when query has exactly one result with transaction', async () => {
  await addPersonToDB(now, {
    handle: 'testtx',
    displayName: 'Test Person TX',
  })

  const query = personRefs.personByHandleQuery('testtx')

  const result = await testDB.runTransaction(async (reader) =>
    checkDocumentInQueryExists(query, {
      auth: authData,
      reader,
    }),
  )

  expect(normalizeData(result)).toMatchInlineSnapshot(`
    {
      "created": "/Timestamp 0000/",
      "displayName": "Test Person TX",
      "handle": "testtx",
      "id": "person-id-1",
      "stats": {
        "active": 0,
        "archived": 0,
      },
      "updated": "/Timestamp 0000/",
      "v": 1,
    }
  `)
})

it('forwards details to the error and the log when query has multiple results', async () => {
  await addPersonToDB(now, {
    id: TestPersonID1,
    handle: 'duplicatedetails',
    displayName: 'Person 1',
  })
  await addPersonToDB(now, {
    id: TestPersonID2,
    handle: 'duplicatedetails',
    displayName: 'Person 2',
  })

  const query = personRefs.personByHandleQuery('duplicatedetails')

  const error = await captureError(
    checkDocumentInQueryExists(query, {
      auth: authData,
      details: { step: 'after-capture' },
    }),
  )

  expect(error).toMatchInlineSnapshot(
    `[Error: Expected at most 1 document in query, found 2]`,
  )
  expect(error.code).toBe('internal')
  expect(error.details).toMatchInlineSnapshot(`
    {
      "step": "after-capture",
    }
  `)
  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[INTERNAL] Expected at most 1 document in query, found 2 [UID: test-uid]",
      {
        "step": "after-capture",
      },
    ]
  `)
})

it('forwards details to the error when query has multiple results with transaction', async () => {
  await addPersonToDB(now, {
    id: TestPersonID1,
    handle: 'duplicatedetailstx',
    displayName: 'Person 1',
  })
  await addPersonToDB(now, {
    id: TestPersonID2,
    handle: 'duplicatedetailstx',
    displayName: 'Person 2',
  })

  const query = personRefs.personByHandleQuery('duplicatedetailstx')

  const error = await captureError(
    testDB.runTransaction(async (reader) =>
      checkDocumentInQueryExists(query, {
        auth: authData,
        reader,
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

it('forwards details to the error and the log when query is empty and errorIfEmpty is provided', async () => {
  const query = personRefs.personByHandleQuery('nonexistentdetails')

  const error = await captureError(
    checkDocumentInQueryExists(query, {
      auth: authData,
      errorIfEmpty: 'Person not found for handle nonexistentdetails',
      details: { step: 'after-capture' },
    }),
  )

  expect(error).toMatchInlineSnapshot(
    `[Error: Person not found for handle nonexistentdetails]`,
  )
  expect(error.code).toBe('internal')
  expect(error.details).toMatchInlineSnapshot(`
    {
      "step": "after-capture",
    }
  `)
  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]).toMatchInlineSnapshot(`
    [
      "[INTERNAL] Person not found for handle nonexistentdetails [UID: test-uid]",
      {
        "step": "after-capture",
      },
    ]
  `)
})

it('leaves details undefined when details is not provided', async () => {
  const query = personRefs.personByHandleQuery('nonexistentnodetails')

  const error = await captureError(
    checkDocumentInQueryExists(query, {
      auth: authData,
      errorIfEmpty: 'Person not found for handle nonexistentnodetails',
    }),
  )

  expect(error.details).toBeUndefined()
  expect(vi.mocked(logger.error)).toHaveBeenCalledOnce()
  expect(vi.mocked(logger.error).mock.calls[0]?.[1]).toBeUndefined()
})

it('returns undefined without logging when query is empty with details but no errorIfEmpty', async () => {
  const query = personRefs.personByHandleQuery('nonexistentnoerror')

  const result = await checkDocumentInQueryExists(query, {
    auth: authData,
    details: { step: 'after-capture' },
  })

  expect(result).toBeUndefined()
  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})

it('returns document data without logging when query has exactly one result with details', async () => {
  await addPersonToDB(now, {
    handle: 'singledetails',
    displayName: 'Test Person Details',
  })

  const query = personRefs.personByHandleQuery('singledetails')

  const result = await checkDocumentInQueryExists(query, {
    auth: authData,
    details: { step: 'after-capture' },
  })

  expect(result?.id).toBe(TestPersonID1)
  expect(result?.displayName).toBe('Test Person Details')
  expect(vi.mocked(logger.error)).not.toHaveBeenCalled()
})
