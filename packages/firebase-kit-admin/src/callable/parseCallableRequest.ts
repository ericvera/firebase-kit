import type { CallableRequest } from 'firebase-functions/https'
import type { AuthData } from 'firebase-functions/tasks'

/**
 * Distributes Omit over a union so each member is independently narrowed.
 * Without this, `Omit<A | B, 'action'>` collapses into a single flat type.
 */
type DistributiveOmit<T, K extends keyof T> = T extends unknown
  ? Omit<T, K>
  : never

/**
 * Builds a discriminated union of `{ action, auth, data }` from a request
 * union `T`. Each member pairs its `action` literal with the remaining fields.
 */
type ParsedRequest<T extends { action: string }> = T extends unknown
  ? {
      auth: AuthData | undefined
      action: T['action']
      data: DistributiveOmit<T, 'action'>
    }
  : never

/**
 * Parses a grouped callable request by extracting `auth`, `action`, and the
 * remaining `data` (with `action` stripped). Preserves the discriminated union
 * on `action` so TypeScript narrows `data` inside each switch branch.
 */
export const parseCallableRequest = <T extends { action: string }>(
  request: CallableRequest<T>,
): ParsedRequest<T> => {
  const { auth } = request
  const { action, ...data } = request.data

  return { auth, action, data } as ParsedRequest<T>
}
