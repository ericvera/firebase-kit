import { KeepaliveCallError } from '../KeepaliveCallError.js'

/**
 * HTTP status to callable code, copied from the Functions SDK's unexported
 * `codeForHTTPStatus`. A status missing from it maps to `unknown`.
 */
const CodeByHttpStatus: Record<number, string> = {
  // Status 0, a request that got no response, is `internal` in the SDK.
  0: 'internal',
  400: 'invalid-argument',
  401: 'unauthenticated',
  403: 'permission-denied',
  404: 'not-found',
  409: 'aborted',
  429: 'resource-exhausted',
  499: 'cancelled',
  500: 'internal',
  501: 'unimplemented',
  503: 'unavailable',
  504: 'deadline-exceeded',
}

/**
 * Envelope `error.status` to callable code, copied from the SDK's unexported
 * `errorCodeMap`. A status missing from it makes the SDK report an internal
 * error.
 */
const CodeByEnvelopeStatus: Record<string, string> = {
  OK: 'ok',
  CANCELLED: 'cancelled',
  UNKNOWN: 'unknown',
  INVALID_ARGUMENT: 'invalid-argument',
  DEADLINE_EXCEEDED: 'deadline-exceeded',
  NOT_FOUND: 'not-found',
  ALREADY_EXISTS: 'already-exists',
  PERMISSION_DENIED: 'permission-denied',
  UNAUTHENTICATED: 'unauthenticated',
  RESOURCE_EXHAUSTED: 'resource-exhausted',
  FAILED_PRECONDITION: 'failed-precondition',
  ABORTED: 'aborted',
  OUT_OF_RANGE: 'out-of-range',
  UNIMPLEMENTED: 'unimplemented',
  INTERNAL: 'internal',
  UNAVAILABLE: 'unavailable',
  DATA_LOSS: 'data-loss',
}

const getCodeForHttpStatus = (status: number): string => {
  if (status >= 200 && status < 300) {
    return 'ok'
  }

  return CodeByHttpStatus[status] ?? 'unknown'
}

/**
 * Narrows a parsed response body to its `error` envelope. A body without an
 * object at `error` carries no callable error.
 */
const getErrorEnvelope = (body: unknown): object | undefined => {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return undefined
  }

  const { error } = body

  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  return error
}

/**
 * Turns a non-2xx callable response into the error the keepalive caller
 * reports, in the same order as the SDK's unexported `_errorForResponse`. The
 * HTTP status sets the code, then the error envelope overrides the code, the
 * description and the details. `details` is attached without the SDK's
 * `decode` pass.
 */
export const toKeepaliveCallError = (
  status: number,
  body: unknown,
): KeepaliveCallError => {
  let code = getCodeForHttpStatus(status)
  let description = code
  let details: unknown

  const envelope = getErrorEnvelope(body)

  if (envelope !== undefined) {
    if ('status' in envelope && typeof envelope.status === 'string') {
      // `Object.hasOwn` keeps a status such as `toString` from matching an
      // inherited member.
      const envelopeCode = Object.hasOwn(CodeByEnvelopeStatus, envelope.status)
        ? CodeByEnvelopeStatus[envelope.status]
        : undefined

      // The SDK stops at an unrecognized status and drops the message and
      // details.
      if (envelopeCode === undefined) {
        return new KeepaliveCallError('internal', {
          code: 'functions/internal',
          status,
        })
      }

      code = envelopeCode
      description = envelope.status
    }

    if ('message' in envelope && typeof envelope.message === 'string') {
      description = envelope.message
    }

    if ('details' in envelope) {
      details = envelope.details
    }
  }

  return new KeepaliveCallError(description, {
    code: `functions/${code}`,
    status,
    details,
  })
}
