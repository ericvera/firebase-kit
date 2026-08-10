/**
 * Where the browser is running the app from, decided by hostname alone.
 * `local` means a developer machine — localhost or a private-network address a
 * phone on the same wifi uses to reach the dev server.
 */
export enum HostingEnvironment {
  Local = 'local',
  Live = 'live',
}
