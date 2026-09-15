import type { FirebaseApp } from 'firebase/app'
import type { AppCheck } from 'firebase/app-check'
import type { Auth } from 'firebase/auth'
import type { Functions } from 'firebase/functions'

/**
 * Map of callable actions to their `[request, response]` pair. Each app
 * supplies its own; the client only needs the two positions.
 */
export type RequestResponseMap = Record<string, [object | undefined, unknown]>

/** Per-callable-group overrides on top of the group's defaults. */
export interface ActionableFunctionCallerOptions<
  TRateLimitCategory extends string,
  TCommand extends string = string,
> {
  /** Callable timeout in milliseconds. Omitted leaves the SDK default. */
  timeoutMs?: number
  /** Per-action rate-limit categories overriding the group default. */
  rateLimitMap?: Partial<Record<TCommand, TRateLimitCategory>>
}

/**
 * Everything the caller needs from the host app, each collaborator already
 * bound to it. An app assembles this once and passes the same value to every
 * group it builds, which is what keeps the groups on one rate-limit budget and
 * one connectivity policy.
 */
export interface ActionableFunctionCallerDependencies<
  TRateLimitCategory extends string,
> {
  /** API version stamped onto every request as `v`. */
  currentAPIVersion: number
  /** Records the call and throws once the key exceeds its category's window. */
  checkRateLimit: (functionName: string, category: TRateLimitCategory) => void
  /** Wraps the call so connectivity failures surface as `ConnectivityError`. */
  withConnectivityHandling: <T>(serviceCall: () => Promise<T>) => Promise<T>
  /** Builds the error a failed call surfaces as. */
  toActionableError: (error: unknown, message: string) => Error
  /**
   * Firebase app to call through. Undefined binds the default app and the
   * default region, which is only correct for a default-region deployment.
   */
  firebaseApp: FirebaseApp | undefined
  /**
   * Pre-built Functions instance, for a non-default region or custom domain.
   * Wins over `firebaseApp` when both are given.
   */
  functions: Functions | undefined
}

/** Where a connected Functions emulator listens. */
export interface FunctionsEmulator {
  /** Emulator host, such as `localhost`. */
  host: string
  /** Emulator port, such as 5001. */
  port: number
}

/** Per-callable-group overrides for the keepalive caller. */
export interface KeepaliveFunctionCallerOptions<
  TRateLimitCategory extends string,
  TCommand extends string = string,
> {
  /** Per-action rate-limit categories overriding the group default. */
  rateLimitMap?: Partial<Record<TCommand, TRateLimitCategory>>
  /**
   * Receives every failure the call runs into. The call never throws, so this
   * is the only place a failure surfaces. Omitting it makes failures silent.
   */
  onError?: (error: Error) => void
}

/**
 * Everything the keepalive caller needs from the host app, each collaborator
 * already bound to it. It takes the same `checkRateLimit` as the actionable
 * caller, so one budget covers both, along with the Firebase instances the
 * request is built from.
 */
export interface KeepaliveFunctionCallerDependencies<
  TRateLimitCategory extends string,
> {
  /** API version stamped onto every request as `v`. */
  currentAPIVersion: number
  /** Records the call and throws once the key exceeds its category's window. */
  checkRateLimit: (functionName: string, category: TRateLimitCategory) => void
  /**
   * Firebase app to call through. Undefined binds the default app and the
   * default region, which is only correct for a default-region deployment.
   */
  firebaseApp: FirebaseApp | undefined
  /**
   * Pre-built Functions instance, for a non-default region or custom domain.
   * Wins over `firebaseApp` when both are given.
   */
  functions: Functions | undefined
  /**
   * Auth instance the call reads its ID token from. Undefined sends the call
   * with no `Authorization` header.
   */
  auth: Auth | undefined
  /**
   * App Check instance the call reads its attestation token from. Undefined
   * sends the call with no `X-Firebase-AppCheck` header.
   */
  appCheck: AppCheck | undefined
  /**
   * Functions emulator to send to, mirroring the app's
   * `connectFunctionsEmulator` call. Undefined sends to the deployed
   * functions.
   */
  emulator: FunctionsEmulator | undefined
}
