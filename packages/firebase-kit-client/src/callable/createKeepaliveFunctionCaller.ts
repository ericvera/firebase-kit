import type { WithAPIVersion } from 'firebase-kit-protocol'
import type { Functions } from 'firebase/functions'
import { KeepaliveCallError } from './KeepaliveCallError.js'
import { KeepaliveBodyLimitBytes } from './constants.js'
import { getCallableUrl } from './internal/getCallableUrl.js'
import { getTokenHeaders } from './internal/getTokenHeaders.js'
import { toKeepaliveCallError } from './internal/toKeepaliveCallError.js'
import type {
  KeepaliveFunctionCallerDependencies,
  KeepaliveFunctionCallerOptions,
  RequestResponseMap,
} from './types.js'

/**
 * Creates a fire-and-forget caller for one callable group. It sends the same
 * request as `createActionableFunctionCaller`, with `keepalive: true`, so a
 * tap that navigates the page away does not cancel it. The returned function
 * checks the rate limit first, returns `void`, never throws, and reports every
 * failure to `options.onError`, a rate-limit failure as the limiter's own
 * error.
 */
export const createKeepaliveFunctionCaller = <
  TCommand extends string,
  TMap extends RequestResponseMap,
  TRateLimitCategory extends string,
>(
  dependencies: KeepaliveFunctionCallerDependencies<TRateLimitCategory>,
  name: string,
  defaultCategory: TRateLimitCategory,
  options: KeepaliveFunctionCallerOptions<TRateLimitCategory, TCommand> = {},
) => {
  const report = (error: unknown): void => {
    const { onError } = options

    if (onError === undefined) {
      return
    }

    const reported =
      error instanceof Error
        ? error
        : new KeepaliveCallError(`Keepalive call to '${name}' failed`, {
            cause: error,
          })

    try {
      onError(reported)
    } catch {
      // A throwing `onError` is swallowed so nothing escapes the caller.
    }
  }

  const send = async <A extends TCommand & keyof TMap>(
    action: A,
    data: TMap[A][0],
  ): Promise<void> => {
    const category = options.rateLimitMap?.[action] ?? defaultCategory
    dependencies.checkRateLimit(`${name}:${action}`, category)

    let functions: Functions

    try {
      if (dependencies.functions === undefined) {
        // Imported inside the call so the Functions SDK stays out of the host
        // app's initial bundle.
        const { getFunctions } = await import('firebase/functions')

        functions = getFunctions(dependencies.firebaseApp)
      } else {
        functions = dependencies.functions
      }
    } catch (error) {
      throw new KeepaliveCallError(
        `Keepalive call to '${name}' has no Functions instance. Pass 'functions' or 'firebaseApp' in the dependencies.`,
        { cause: error },
      )
    }

    const actionRequest = { ...data, action }
    const dataWithVersion: WithAPIVersion<typeof actionRequest> = {
      ...actionRequest,
      v: dependencies.currentAPIVersion,
    }

    // The JSON round trip drops undefined properties instead of sending null,
    // as the actionable caller does. `JSON.parse` is typed `any`, so the
    // result is held at `unknown`.
    const sanitizedData: unknown = JSON.parse(JSON.stringify(dataWithVersion))

    const body = JSON.stringify({ data: sanitizedData })
    const size = new TextEncoder().encode(body).byteLength

    if (size > KeepaliveBodyLimitBytes) {
      throw new KeepaliveCallError(
        `Keepalive call to '${name}' action '${action}' has a body of ${String(size)} bytes, over the ${String(KeepaliveBodyLimitBytes)} byte keepalive limit.`,
      )
    }

    // The rest holds only `credentials`, so the init object carries no
    // `credentials` key outside a Cloud Workstation.
    const { url, ...credentials } = getCallableUrl(
      functions,
      dependencies.emulator,
      name,
    )

    const headers = {
      'Content-Type': 'application/json',
      ...(await getTokenHeaders(dependencies.auth, dependencies.appCheck)),
    }

    let response: Response

    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        keepalive: true,
        ...credentials,
      })
    } catch (error) {
      throw new KeepaliveCallError(`Keepalive call to '${name}' failed`, {
        cause: error,
      })
    }

    if (!response.ok) {
      let json: unknown = null

      try {
        json = await response.json()
      } catch {
        // A non-JSON body carries no error envelope, so the status alone
        // decides.
      }

      throw toKeepaliveCallError(response.status, json)
    }
  }

  return <A extends TCommand & keyof TMap>(
    action: A,
    data: TMap[A][0],
  ): void => {
    // The caller returns before the request resolves, and every failure goes
    // to `report`.
    void send(action, data).catch(report)
  }
}
