import type { Functions } from 'firebase/functions'
import { KeepaliveCallError } from '../KeepaliveCallError.js'
import type { FunctionsEmulator } from '../types.js'

const CloudWorkstationSuffix = '.cloudworkstations.dev'

/** Where a callable request goes and how it is credentialed. */
export interface CallableTarget {
  /** Absolute URL of the callable. */
  url: string
  /**
   * Present only for a Cloud Workstation emulator, so the `fetch` init carries
   * no `credentials` key anywhere else.
   */
  credentials?: 'include'
}

/**
 * Project the URL shapes that name a project are built from. Only a custom
 * domain can do without one.
 */
const getProjectId = (functions: Functions, name: string): string => {
  const { projectId } = functions.app.options

  if (projectId === undefined) {
    throw new KeepaliveCallError(
      `Keepalive call to '${name}' cannot build its URL because the Firebase app has no 'app.options.projectId'.`,
    )
  }

  return projectId
}

/**
 * Builds the URL for one callable from public `Functions` members, in the same
 * precedence the SDK's own builder uses. An emulator wins over a custom
 * domain, which wins over the deployed `cloudfunctions.net` host.
 */
export const getCallableUrl = (
  functions: Functions,
  emulator: FunctionsEmulator | undefined,
  name: string,
): CallableTarget => {
  if (emulator !== undefined) {
    // A workstation emulator is reached over TLS, and is the one case the SDK
    // credentials the request.
    const secure = emulator.host.endsWith(CloudWorkstationSuffix)
    const projectId = getProjectId(functions, name)
    const scheme = secure ? 'https' : 'http'

    return {
      url: `${scheme}://${emulator.host}:${String(emulator.port)}/${projectId}/${functions.region}/${name}`,
      ...(secure ? { credentials: 'include' as const } : {}),
    }
  }

  if (functions.customDomain !== null) {
    return { url: `${functions.customDomain}/${name}` }
  }

  return {
    url: `https://${functions.region}-${getProjectId(functions, name)}.cloudfunctions.net/${name}`,
  }
}
