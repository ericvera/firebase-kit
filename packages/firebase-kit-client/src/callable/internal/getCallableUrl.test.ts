import type { Functions } from 'firebase/functions'
import { expect, it } from 'vitest'
import { KeepaliveCallError } from '../KeepaliveCallError.js'
import { getCallableUrl } from './getCallableUrl.js'

interface FunctionsShape {
  projectId?: string | undefined
  region?: string
  customDomain?: string | null
}

const DefaultShape: Required<FunctionsShape> = {
  projectId: 'demo-keepalive',
  region: 'us-central1',
  customDomain: null,
}

// Structural rather than a real instance, because the builder reads only
// `app.options.projectId`, `region` and `customDomain`.
const createFunctions = (overrides: FunctionsShape = {}): Functions => {
  // Spread rather than destructured with defaults, so a case can drop
  // `projectId` back to undefined.
  const { projectId, region, customDomain } = { ...DefaultShape, ...overrides }

  return {
    app: {
      name: 'keepalive-url',
      // An app configured without a project has no key at all, rather than
      // one holding undefined.
      options: projectId === undefined ? {} : { projectId },
      automaticDataCollectionEnabled: false,
    },
    region,
    customDomain,
  }
}

const getThrown = (build: () => unknown) => {
  try {
    build()

    return undefined
  } catch (error) {
    return {
      isKeepaliveCallError: error instanceof KeepaliveCallError,
      message: error instanceof Error ? error.message : undefined,
    }
  }
}

it('builds the deployed URL from the default region and the project', () => {
  // Verify: cloudfunctions.net host, no credentials key
  expect(getCallableUrl(createFunctions(), undefined, 'beacons'))
    .toMatchInlineSnapshot(`
    {
      "url": "https://us-central1-demo-keepalive.cloudfunctions.net/beacons",
    }
  `)
})

it('builds the deployed URL from the region the instance carries', () => {
  // Verify: the named region replaces us-central1
  expect(
    getCallableUrl(
      createFunctions({ region: 'europe-west1' }),
      undefined,
      'beacons',
    ),
  ).toMatchInlineSnapshot(`
    {
      "url": "https://europe-west1-demo-keepalive.cloudfunctions.net/beacons",
    }
  `)
})

it('builds the custom domain URL without needing a project', () => {
  // Verify: custom domain plus the group name, projectId never read
  expect(
    getCallableUrl(
      createFunctions({
        projectId: undefined,
        customDomain: 'https://api.example.com',
      }),
      undefined,
      'beacons',
    ),
  ).toMatchInlineSnapshot(`
    {
      "url": "https://api.example.com/beacons",
    }
  `)
})

it('builds a plain http URL for a local emulator', () => {
  // Verify: http scheme, project and region path segments, no credentials key
  expect(
    getCallableUrl(
      createFunctions(),
      { host: 'localhost', port: 5001 },
      'beacons',
    ),
  ).toMatchInlineSnapshot(`
    {
      "url": "http://localhost:5001/demo-keepalive/us-central1/beacons",
    }
  `)
})

it('builds an https URL and asks for credentials on a Cloud Workstation', () => {
  // Verify: https scheme and credentials include
  expect(
    getCallableUrl(
      createFunctions(),
      { host: 'demo.cloudworkstations.dev', port: 5001 },
      'beacons',
    ),
  ).toMatchInlineSnapshot(`
    {
      "credentials": "include",
      "url": "https://demo.cloudworkstations.dev:5001/demo-keepalive/us-central1/beacons",
    }
  `)
})

it('sends to the emulator even when the instance has a custom domain', () => {
  // Verify: emulator wins over customDomain
  expect(
    getCallableUrl(
      createFunctions({ customDomain: 'https://api.example.com' }),
      { host: 'localhost', port: 5001 },
      'beacons',
    ),
  ).toMatchInlineSnapshot(`
    {
      "url": "http://localhost:5001/demo-keepalive/us-central1/beacons",
    }
  `)
})

it('refuses the deployed URL when the app options have no project', () => {
  // Verify: KeepaliveCallError naming app.options.projectId and the group
  expect(
    getThrown(() =>
      getCallableUrl(
        createFunctions({ projectId: undefined }),
        undefined,
        'beacons',
      ),
    ),
  ).toMatchInlineSnapshot(`
    {
      "isKeepaliveCallError": true,
      "message": "Keepalive call to 'beacons' cannot build its URL because the Firebase app has no 'app.options.projectId'.",
    }
  `)
})

it('refuses the emulator URL when the app options have no project', () => {
  // Verify: same refusal on the emulator shape
  expect(
    getThrown(() =>
      getCallableUrl(
        createFunctions({ projectId: undefined }),
        { host: 'localhost', port: 5001 },
        'beacons',
      ),
    ),
  ).toMatchInlineSnapshot(`
    {
      "isKeepaliveCallError": true,
      "message": "Keepalive call to 'beacons' cannot build its URL because the Firebase app has no 'app.options.projectId'.",
    }
  `)
})
