import { afterEach, expect, it, vi } from 'vitest'
import { HostingEnvironment } from './constants.js'
import { getHostingEnvironment } from './getHostingEnvironment.js'

const setHostname = (hostname: string) => {
  vi.stubGlobal('window', { location: { hostname } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('reports live when there is no window at all', () => {
  vi.stubGlobal('window', undefined)

  // Verify: a server render has no hostname to read, and must take the live
  // path rather than a development-only one
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Live)
})

it('reports local for localhost', () => {
  setHostname('localhost')

  // Verify: the ordinary dev-server hostname
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Local)
})

it('reports local for a loopback address', () => {
  setHostname('127.0.0.1')

  // Verify: 127.0.0.0/8 counts, so hitting the dev server by IP behaves the
  // same as by name
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Local)
})

it('reports local for a private 192.168 address', () => {
  setHostname('192.168.1.42')

  // Verify: a phone on the same wifi reaching the dev server is still local
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Local)
})

it('reports local for a private 10.x address', () => {
  setHostname('10.0.0.5')

  // Verify: the 10.0.0.0/8 range
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Local)
})

it('reports local for a private 172.16 address', () => {
  setHostname('172.16.0.9')

  // Verify: the bottom of the 172.16.0.0/12 range
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Local)
})

it('reports local for a private 172.31 address', () => {
  setHostname('172.31.255.254')

  // Verify: the top of the 172.16.0.0/12 range
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Local)
})

it('reports live for a 172 address outside the private range', () => {
  setHostname('172.32.0.1')

  // Verify: the range boundary is real — 172.32 is public, so it must not be
  // mistaken for a dev machine
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Live)
})

it('reports live for a public hostname', () => {
  setHostname('app.example.com')

  // Verify: the deployed case
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Live)
})

it('reports live for a hostname that merely starts with a private prefix', () => {
  setHostname('10-0-0-5.example.com')

  // Verify: the pattern anchors on a dotted octet, so a hostname that happens
  // to begin with those digits is not treated as an IP
  expect(getHostingEnvironment()).toEqual(HostingEnvironment.Live)
})
