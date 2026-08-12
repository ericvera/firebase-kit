import type { SuccessResult } from './constants.js'

/**
 * Utility type to add v (API version) field to request data types. Used for
 * callable functions to enforce API version checking with backward
 * compatibility support.
 *
 * When T is undefined (commands with no request data), produces `{ v: number }`
 * instead of `never` (which `undefined & { v: number }` would yield).
 */
export type WithAPIVersion<T> = [T] extends [undefined]
  ? { v: number }
  : T & { v: number }

/**
 * The request a handler receives for a single action: the action
 * discriminator plus that action's payload.
 *
 * The tuple wrapper in `[TPayload] extends [undefined]` stops the conditional
 * from distributing over a union payload.
 */
type ActionRequest<TAction extends string, TPayload> = [TPayload] extends [
  undefined,
]
  ? { action: TAction }
  : { action: TAction } & TPayload

/**
 * Derives the request and response types of a callable group — a single
 * Firebase callable that dispatches on an `action` field — from that group's
 * command to `[request payload, response]` map. A group declares the map and
 * reads the five members below off this type, instead of hand-writing the
 * same five aliases once per group.
 *
 * A command whose request payload is `undefined` yields `{ action: A }`
 * rather than `never`, for every group.
 */
export interface CallableMap<
  TCommand extends string,
  TMap extends Record<TCommand, [unknown, unknown]>,
> {
  /** Request payload of each command, without the action discriminator */
  RequestFor: { [A in TCommand]: TMap[A][0] }

  /** Request a handler receives for each command (action plus payload) */
  ActionRequestData: { [A in TCommand]: ActionRequest<A, TMap[A][0]> }

  /**
   * Discriminated union of every version-stamped request the group accepts.
   * The client stamps the version onto the action request; the server strips
   * it back off.
   */
  RequestData: {
    [A in TCommand]: WithAPIVersion<ActionRequest<A, TMap[A][0]>>
  }[TCommand]

  /** Response of each command */
  ResponseFor: { [A in TCommand]: TMap[A][1] }

  /** Union of every response the group can return */
  ResponseData: TMap[TCommand][1]
}

/**
 * Do not use this directly, only as a base for other response types that only
 * have success as a valid result.
 */
export interface SuccessResponseData {
  result: SuccessResult
}

export type IsEverythingOKRequestData = undefined

export type IsEverythingOKResponseData = SuccessResponseData

export type LogErrorRequestData = undefined

export type LogErrorResponseData = SuccessResponseData
