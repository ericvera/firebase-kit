import { getAuth } from 'firebase-admin/auth'
import type { AuthData } from 'firebase-functions/tasks'
import {
  FunctionsInternalError,
  FunctionsPermissionDeniedError,
} from '../errors/index.js'

/**
 * Half of the token-refresh handshake that runs at the top of every authorized
 * request. It loads the caller's stored custom claims and rejects the request
 * whenever the version stamped on the caller's token differs from the stored
 * one in either direction: a lower version means the token is stale, while a
 * higher one claims a version the stored claims never reached and so cannot be
 * trusted. Any mismatch is the signal the client uses to force a token refresh
 * and retry. Returns the loaded claims so the caller can run its own role
 * checks without a second Auth round-trip.
 *
 * @throws FunctionsInternalError when the request carries no uid
 * @throws FunctionsPermissionDeniedError when the token's claims version
 * differs from the stored one in either direction
 */
export const checkClaimsVersion = async <TClaims extends { v?: number }>(
  auth: AuthData | undefined,
): Promise<TClaims> => {
  const uid = auth?.uid

  if (!uid) {
    throw new FunctionsInternalError(auth, 'User unexpectedly not found', {
      uid,
    })
  }

  // Load the user from auth rather than just checking the token to ensure the
  // user access has not been revoked.
  const user = await getAuth().getUser(uid)
  const claims = user.customClaims as TClaims

  // - Check user claims version matched the one received in the token. The
  // stored version is read off the Auth record rather than off `claims`,
  // because a user whose claims were never written has no `customClaims` at
  // all and the assertion above cannot express that.
  if (auth.token['v'] !== user.customClaims?.['v']) {
    // Throw an error that the client processes as a token refresh

    throw new FunctionsPermissionDeniedError(
      auth,
      'User claims version does not match the token',
    )
  }

  return claims
}
