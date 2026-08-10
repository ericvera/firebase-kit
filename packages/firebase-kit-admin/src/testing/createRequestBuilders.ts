import type {
  CallableRequest,
  Request as HttpsRequest,
} from 'firebase-functions/https'
import type { AuthData } from 'firebase-functions/tasks'
import type { WithAPIVersion } from 'firebase-kit-protocol'
import type { RequestBuildersOptions } from './types.js'

/**
 * Builds the request fixtures that carry an application's wire configuration —
 * the API version envelope and the origin header. An application binds this
 * once and re-exports both builders from its test harness. Builders that need
 * no configuration (`createTaskRequest`, `createSecretParam`) are plain
 * exports of this package instead.
 */
export const createRequestBuilders = ({
  apiVersion,
  appUrl,
}: RequestBuildersOptions) => {
  const createHandlerRequestData = <T>(data: T): WithAPIVersion<T> => ({
    ...data,
    v: apiVersion,
  })

  const createCallableRequest = <T>(
    data: T,
    auth: AuthData | undefined,
  ): CallableRequest<WithAPIVersion<T>> => ({
    data: { ...data, v: apiVersion },
    rawRequest: {
      headers: {
        origin: appUrl,
      },
    } as HttpsRequest,
    // NOTE: `auth` is an optional property with no `undefined` in its type, so
    // an unauthenticated request omits it rather than setting it to undefined.
    // Either shape reads back as `request.auth === undefined`.
    ...(auth === undefined ? {} : { auth }),
    acceptsStreaming: false,
  })

  return {
    createCallableRequest,
    createHandlerRequestData,
  }
}
