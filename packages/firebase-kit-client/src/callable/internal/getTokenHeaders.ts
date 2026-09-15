import type { AppCheck } from 'firebase/app-check'
import type { Auth } from 'firebase/auth'

/**
 * Collects the auth and App Check headers for one call from the instances the
 * host supplied. A token that cannot be obtained is left out rather than
 * failing the call, which matches the fire-and-forget contract. The caller
 * adds the content type.
 */
export const getTokenHeaders = async (
  auth: Auth | undefined,
  appCheck: AppCheck | undefined,
): Promise<Record<string, string>> => {
  const getAuthToken = async (): Promise<string | undefined> => {
    if (auth === undefined) {
      return undefined
    }

    try {
      // Without this the token would be missed whenever the call lands before
      // persistence has restored the session.
      await auth.authStateReady()

      return await auth.currentUser?.getIdToken()
    } catch {
      // A refresh that cannot reach the auth backend still leaves the call
      // worth sending unauthenticated.
      return undefined
    }
  }

  const getAppCheckToken = async (): Promise<string | undefined> => {
    if (appCheck === undefined) {
      return undefined
    }

    try {
      // Imported inside the call so the App Check SDK stays out of the host
      // app's initial bundle.
      const { getToken } = await import('firebase/app-check')

      return (await getToken(appCheck)).token
    } catch {
      // `getToken` throws when the attestation exchange fails, and the
      // backend rejecting the unattested call is the better failure.
      return undefined
    }
  }

  const [authToken, appCheckToken] = await Promise.all([
    getAuthToken(),
    getAppCheckToken(),
  ])

  const headers: Record<string, string> = {}

  if (authToken !== undefined && authToken !== '') {
    headers['Authorization'] = `Bearer ${authToken}`
  }

  // An empty App Check token is still sent, as the SDK sends it, so the
  // backend sees an attempted attestation rather than none.
  if (appCheckToken !== undefined) {
    headers['X-Firebase-AppCheck'] = appCheckToken
  }

  return headers
}
