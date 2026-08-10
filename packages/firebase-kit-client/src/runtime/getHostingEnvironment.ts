import { HostingEnvironment } from './constants.js'

// 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 and 127.0.0.0/8 — the ranges a dev
// server is reachable on from another device on the same network.
const PrivateIPPattern = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.)/

const isPrivateIP = (ip: string): boolean => PrivateIPPattern.test(ip)

/**
 * Reads the hosting environment off `window.location.hostname`. Server renders
 * have no `window`, so they report `Live` — the safe answer, since a server
 * render must never take a development-only path.
 */
export const getHostingEnvironment = (): HostingEnvironment => {
  if (typeof window === 'undefined') {
    return HostingEnvironment.Live
  }

  const hostname = window.location.hostname

  if (hostname === 'localhost' || isPrivateIP(hostname)) {
    return HostingEnvironment.Local
  }

  return HostingEnvironment.Live
}
