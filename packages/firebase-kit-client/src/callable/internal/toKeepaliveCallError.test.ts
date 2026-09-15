import { expect, it } from 'vitest'
import { getErrorWithCode } from '../../getErrorWithCode.js'
import { toKeepaliveCallError } from './toKeepaliveCallError.js'

const HttpStatusCases: [status: number, code: string][] = [
  [200, 'functions/ok'],
  [204, 'functions/ok'],
  [0, 'functions/internal'],
  [400, 'functions/invalid-argument'],
  [401, 'functions/unauthenticated'],
  [403, 'functions/permission-denied'],
  [404, 'functions/not-found'],
  [409, 'functions/aborted'],
  [429, 'functions/resource-exhausted'],
  [499, 'functions/cancelled'],
  [500, 'functions/internal'],
  [501, 'functions/unimplemented'],
  [503, 'functions/unavailable'],
  [504, 'functions/deadline-exceeded'],
  [418, 'functions/unknown'],
  [302, 'functions/unknown'],
]

const EnvelopeStatusCases: [envelopeStatus: string, code: string][] = [
  ['OK', 'functions/ok'],
  ['CANCELLED', 'functions/cancelled'],
  ['UNKNOWN', 'functions/unknown'],
  ['INVALID_ARGUMENT', 'functions/invalid-argument'],
  ['DEADLINE_EXCEEDED', 'functions/deadline-exceeded'],
  ['NOT_FOUND', 'functions/not-found'],
  ['ALREADY_EXISTS', 'functions/already-exists'],
  ['PERMISSION_DENIED', 'functions/permission-denied'],
  ['UNAUTHENTICATED', 'functions/unauthenticated'],
  ['RESOURCE_EXHAUSTED', 'functions/resource-exhausted'],
  ['FAILED_PRECONDITION', 'functions/failed-precondition'],
  ['ABORTED', 'functions/aborted'],
  ['OUT_OF_RANGE', 'functions/out-of-range'],
  ['UNIMPLEMENTED', 'functions/unimplemented'],
  ['INTERNAL', 'functions/internal'],
  ['UNAVAILABLE', 'functions/unavailable'],
  ['DATA_LOSS', 'functions/data-loss'],
]

const PrototypeKeyStatuses = [
  'toString',
  'constructor',
  '__proto__',
  'hasOwnProperty',
]

const UnusableBodyCases: [label: string, body: unknown][] = [
  ['null body', null],
  ['undefined body', undefined],
  ['a string body', 'Internal Server Error'],
  ['a non-object error member', { error: 'x' }],
  ['a null error member', { error: null }],
  ['a non-string envelope status', { error: { status: 42 } }],
  ['a non-string envelope message', { error: { message: 7 } }],
]

it.each(HttpStatusCases)(
  'maps HTTP status %i with an empty body to %s',
  (status, code) => {
    const error = toKeepaliveCallError(status, {})

    // Verify: code from the status alone, message is the bare code
    expect(error.code).toBe(code)
    expect(error.status).toBe(status)
    expect(`functions/${error.message}`).toBe(code)
    expect(error.details).toBeUndefined()
  },
)

it.each(EnvelopeStatusCases)(
  'maps envelope status %s to %s',
  (envelopeStatus, code) => {
    // 500 so the status code differs from every envelope code but INTERNAL
    const error = toKeepaliveCallError(500, {
      error: { status: envelopeStatus },
    })

    expect(error.code).toBe(code)
    expect(error.message).toBe(envelopeStatus)
    expect(error.status).toBe(500)
  },
)

it('lets the envelope override the code, message and details', () => {
  const error = toKeepaliveCallError(500, {
    error: {
      status: 'FAILED_PRECONDITION',
      message: 'API version missing. Please refresh.',
      details: { minVersion: 5 },
    },
  })

  // Verify: code from the envelope status, message from the envelope, details
  // raw
  expect({
    code: error.code,
    message: error.message,
    status: error.status,
    details: error.details,
  }).toMatchInlineSnapshot(`
    {
      "code": "functions/failed-precondition",
      "details": {
        "minVersion": 5,
      },
      "message": "API version missing. Please refresh.",
      "status": 500,
    }
  `)
})

it('reports an unrecognized envelope status as internal without details', () => {
  const error = toKeepaliveCallError(400, {
    error: {
      status: 'NOPE',
      message: 'should be ignored',
      details: { ignored: true },
    },
  })

  // Verify: functions/internal, message and details dropped
  expect({
    code: error.code,
    message: error.message,
    details: error.details,
  }).toMatchInlineSnapshot(`
    {
      "code": "functions/internal",
      "details": undefined,
      "message": "internal",
    }
  `)
})

it.each(PrototypeKeyStatuses)(
  'treats the Object.prototype member %s as an unrecognized status',
  (envelopeStatus) => {
    const error = toKeepaliveCallError(400, {
      error: { status: envelopeStatus },
    })

    // Verify: inherited members are not recognized statuses
    expect(error.code).toBe('functions/internal')
    expect(error.message).toBe('internal')
  },
)

it.each(UnusableBodyCases)(
  'falls back to the status-derived code for %s',
  (_label, body) => {
    const error = toKeepaliveCallError(503, body)

    // Verify: code from the status, message is the bare code
    expect(error.status).toBe(503)
    expect(error.code).toBe('functions/unavailable')
    expect(error.message).toBe('unavailable')
  },
)

it('keeps the status-derived code when only the envelope message is usable', () => {
  const error = toKeepaliveCallError(503, { error: { message: 'Try later.' } })

  // Verify: message from an envelope with no status
  expect({ code: error.code, message: error.message }).toMatchInlineSnapshot(`
    {
      "code": "functions/unavailable",
      "message": "Try later.",
    }
  `)
})

it('attaches a non-object details payload untouched', () => {
  const error = toKeepaliveCallError(400, {
    error: { status: 'INVALID_ARGUMENT', details: 'just a string' },
  })

  // Verify: details raw, not decoded or filtered
  expect(error.details).toBe('just a string')
})

it('exposes the decoded code and details to getErrorWithCode', () => {
  const error = toKeepaliveCallError(403, {
    error: { status: 'PERMISSION_DENIED', details: { reason: 'not-a-member' } },
  })

  // Verify: getErrorWithCode reads code and details
  expect(getErrorWithCode(error)).toMatchInlineSnapshot(`
    {
      "code": "functions/permission-denied",
      "details": {
        "reason": "not-a-member",
      },
      "error": [KeepaliveCallError: PERMISSION_DENIED],
    }
  `)
})
