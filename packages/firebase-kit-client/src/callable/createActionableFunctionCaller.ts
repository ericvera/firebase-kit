import type { WithAPIVersion } from 'firebase-kit-protocol'
import type { HttpsCallableResult } from 'firebase/functions'
import { FirestoreVariant } from '../firestore/constants.js'
import { reviveTimestamps } from '../firestore/reviveTimestamps.js'
import type {
  ActionableFunctionCallerDependencies,
  ActionableFunctionCallerOptions,
  RequestResponseMap,
} from './types.js'

/**
 * Creates the caller for one callable group: its name, the rate-limit category
 * its actions default to, and optional timeout / per-action overrides. An app
 * builds one per group (`app`, `fast`, `ai`) and exports the result; a page or
 * store then calls it as `group(action, data)` with the response type inferred
 * from the action.
 *
 * A single Firebase Function dispatches multiple actions: the action is passed
 * as part of the request payload and the response type is inferred from the
 * action via the request/response map.
 *
 * Every host coupling — API version, rate limiting, connectivity, error
 * factory, timestamp revival — arrives already bound in `dependencies`, so the
 * app binds each collaborator once and shares the same one with its direct
 * Firestore reads.
 */
export const createActionableFunctionCaller =
  <
    TCommand extends string,
    TMap extends RequestResponseMap<TCommand>,
    TRateLimitCategory extends string,
  >(
    dependencies: ActionableFunctionCallerDependencies<TRateLimitCategory>,
    name: string,
    defaultCategory: TRateLimitCategory,
    options: ActionableFunctionCallerOptions<TCommand, TRateLimitCategory> = {},
  ) =>
  async <A extends TCommand & keyof TMap>(
    action: A,
    data: TMap[A][0],
  ): Promise<TMap[A][1]> => {
    const { rateLimitMap, timeoutMs } = options

    const category = rateLimitMap?.[action] ?? defaultCategory
    dependencies.checkRateLimit(`${name}:${action}`, category)

    // Imported inside the call so the Functions SDK stays out of the host
    // app's initial bundle.
    const { getFunctions, httpsCallable } = await import('firebase/functions')

    const functions =
      dependencies.functions ?? getFunctions(dependencies.firebaseApp)
    // The payload the SDK receives is the JSON round trip below, whose type
    // `JSON.parse` erases; the request shape is stated on `dataWithVersion`
    // instead, which is what the round trip copies.
    const callable = httpsCallable<unknown, TMap[A][1]>(
      functions,
      name,
      timeoutMs ? { timeout: timeoutMs } : undefined,
    )

    let result: HttpsCallableResult<TMap[A][1]>

    try {
      const actionRequest = { ...data, action }
      const dataWithVersion: WithAPIVersion<typeof actionRequest> = {
        ...actionRequest,
        v: dependencies.currentAPIVersion,
      }

      // NOTE: Firebase functions convert any undefined values to null. By
      // serializing and deserializing the data, undefined properties are just
      // removed rather than converted to null. `JSON.parse` is typed `any`, so
      // the result is held at `unknown` rather than spreading that `any` on.
      const sanitizedData: unknown = JSON.parse(JSON.stringify(dataWithVersion))

      result = await dependencies.withConnectivityHandling(() =>
        callable(sanitizedData),
      )
    } catch (error) {
      throw dependencies.toActionableError(
        error,
        `Error calling service '${name}' action '${action}'`,
      )
    }

    // Outside the try, so a revival failure surfaces as itself rather than as
    // a call failure.
    return reviveTimestamps(result.data, FirestoreVariant.FirestoreLite)
  }
