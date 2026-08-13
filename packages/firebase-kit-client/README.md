# firebase-kit-client

**Client-side Firebase toolkit: typed callable groups, cached Firestore reads,
connectivity handling, and rate limiting**

[![github license](https://img.shields.io/github/license/ericvera/firebase-kit.svg?style=flat-square)](https://github.com/ericvera/firebase-kit/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/firebase-kit-client.svg?style=flat-square)](https://npmjs.org/package/firebase-kit-client)

## Overview

The browser half of [firebase-kit](https://github.com/ericvera/firebase-kit). It
covers the parts of a Firebase front end that every app rewrites: calling a
callable group with the response type inferred from the action, deciding whether
a failed read means "offline" or "broken", serving a cached copy while the
network is down, and catching a runaway loop before it spends a quota.

Almost nothing here reaches for a global. Every host coupling — the error
factory, the connectivity probe, the rate-limit budget, the database id — is
passed in once when the layer is bound, so the same package works under a
framework that owns those things and under one that does not. The exception is
the Firebase app itself on the Firestore side: `getHostingFirestore` resolves it
with `getApp()`, so `firebase-kit-client/firestore` always reads through the
default app. The callable layer has no such constraint — it takes a
`firebaseApp` (or a pre-built `functions`) in its dependencies.

## Features

- **Response types follow the action**: `await callSpaces('get-space', { … })` is
  typed from the group's command map, not cast at the call site
- **One budget across groups**: A rate limiter is bound once and shared, so a
  runaway watcher throws before the call leaves the browser instead of burning
  quota
- **Offline is a first-class outcome**: A connectivity failure arrives as
  `ConnectivityError` carrying a resolved `ConnectionStatus`, which is what lets
  a cached read be served instead of a blank page
- **Read-through caching that never loses data**: The cache is written only on a
  definitive outcome, so a failed refresh always leaves the saved copy intact
- **Timestamps survive the wire**: `Timestamp` instances are rebuilt from the
  plain `{ seconds, nanoseconds }` objects a JSON round trip leaves behind, for
  both the full and the lite Firestore SDKs
- **Test doubles included**: In-memory stand-ins for `firebase/app`,
  `firebase/functions` and `getsetdel`, shipped as a published entry point

## Installation

```bash
npm install firebase-kit-client
# or
yarn add firebase-kit-client
```

### Peer dependencies

npm will not install these for you. Add them yourself:

```bash
npm install firebase 'getsetdel@^2.0.0'
```

**Required**

- **`firebase`** (`^12.17.1`) — the Firebase JS SDK. Loaded through dynamic
  imports, so the Functions and Firestore SDKs stay out of your initial bundle.
- **`getsetdel`** (`^2.0.0`) — the IndexedDB store the cached Firestore reads
  persist through.

**`getsetdel` must be major 2.** `getsetdel` is published at `3.0.0`, so a
project already on v3 will hit a peer-resolution conflict when it adds this
package. That is deliberate rather than an oversight: this package is pinned to
the v2 API, and the range will move when it is ported. Until then, a project on
`getsetdel` 3 has to come back to 2 to install this package at all: the peer is
required, not optional, so the conflict fires at install time no matter which
entry points you go on to import.

**Optional**

- **`vitest`** (`^4.1.10`) — needed only by `firebase-kit-client/testing`. Skip
  it if you do not install the test doubles; nothing on the production entry
  points imports it.

Cached Firestore reads need an IndexedDB implementation. A browser has one; a
Node test run does not — install `fake-indexeddb` as a devDependency and import
`fake-indexeddb/auto` from your vitest setup file.

## Requirements

- Node.js >= 24
- TypeScript >= 5.0 (for TypeScript users)
- ESM only — this package ships no CommonJS build
- A browser (or a DOM-like test environment) for the entry points that read
  `window`, `navigator` or IndexedDB

## Entry Points

| Entry point                        | What it provides                                                                                                                                                        |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firebase-kit-client`              | `getErrorWithCode`, which unwraps a thrown value down to the first `code` it carries, and the `CreateErrorFunction` the rest of the package builds fatal errors through |
| `firebase-kit-client/callable`     | `createActionableFunctionCaller` — one typed caller per callable group — and `toActionableError`                                                                        |
| `firebase-kit-client/connectivity` | `ConnectionStatus`, `ConnectivityError`, and `withConnectivityHandling`, which turns a failed backend call into a resolved connectivity state                           |
| `firebase-kit-client/firestore`    | `createFirestoreUtils` — plain reads, cached reads, cursor paging and cached subscriptions — plus `reviveTimestamps` and `FirestoreVariant`                             |
| `firebase-kit-client/rate-limit`   | `createRateLimiter` and `RateLimitError`: a sliding-window guard that throws before a call leaves the browser                                                           |
| `firebase-kit-client/runtime`      | `getHostingEnvironment`, which reports `Local` or `Live` from the hostname alone                                                                                        |
| `firebase-kit-client/testing`      | `createFirebaseAppMock`, `createFirebaseFunctionsClientMock` and `createGetSetDelMock` — the factories a vitest suite re-exports from its `__mocks__` modules           |

## Usage

The examples below build one app's Firebase layer from the bottom up, each file
importing the ones before it. Everything except the `runtime` and root entry
points needs a browser environment (`window`, `navigator`, IndexedDB) and an
initialized Firebase app to actually run; as written they are wiring, meant to be
type-checked and imported, not executed standalone.

### `firebase-kit-client/runtime`

Where the browser is running the app from, decided by hostname alone. A server
render has no `window`, so it reports `Live` — the safe answer, since a server
render must never take a development-only path.

```typescript
// src/firebase/hosting.ts
import {
  getHostingEnvironment,
  HostingEnvironment,
} from 'firebase-kit-client/runtime'

/** True on localhost or a private-network address a phone on the same wifi uses. */
export const isDev = (): boolean =>
  getHostingEnvironment() === HostingEnvironment.Local
```

### `firebase-kit-client`

The root entry point holds the two things every other entry point needs from the
host app: how to build an error, and how to read a code back off one.
`getErrorWithCode` walks the `cause` chain, because Firebase wraps its errors.

```typescript
// src/firebase/errors.ts
import { getErrorWithCode } from 'firebase-kit-client'
import type { CreateErrorFunction } from 'firebase-kit-client'

/**
 * How this app builds a fatal error. An app whose framework supplies an error
 * factory passes that one through instead.
 */
export const createError: CreateErrorFunction = ({ message, cause, fatal }) =>
  Object.assign(new Error(message, { cause }), { fatal })

export const describeFailure = (thrown: unknown): string => {
  const { code, details } = getErrorWithCode(thrown)

  if (code === undefined) {
    return 'unknown failure'
  }

  return details === undefined ? code : `${code}: ${JSON.stringify(details)}`
}
```

### `firebase-kit-client/rate-limit`

Each limiter owns its own record map, so bind one and share it: two limiters
built from the same window table never share a budget. A key that exceeds its
category's sliding window throws `RateLimitError`, which carries
`CallableErrorCode.ClientRateLimitExceeded` as its `code`. In development the
limiter also warns once as a key crosses half its limit.

```typescript
// src/firebase/rateLimit.ts
import { createRateLimiter } from 'firebase-kit-client/rate-limit'
import type { RateLimitConfig } from 'firebase-kit-client/rate-limit'
import { isDev } from './hosting.js'

export type RateLimitCategory = 'default' | 'high-frequency' | 'expensive'

const rateLimits: Record<RateLimitCategory, RateLimitConfig> = {
  default: { limit: 30, windowMs: 60_000 },
  'high-frequency': { limit: 120, windowMs: 60_000 },
  expensive: { limit: 5, windowMs: 60_000 },
}

/** One budget for the whole app: every callable group is bound to this. */
export const checkRateLimit = createRateLimiter<RateLimitCategory>({
  rateLimits,
  isDev: isDev(),
})
```

### `firebase-kit-client/connectivity`

`withConnectivityHandling` wraps any backend call. On success it marks the
connection healthy, which clears whatever banner a prior failure raised. On a
failure whose code you classify as connectivity-related, it probes, and throws
`ConnectivityError` carrying the resolved status only when the probe agrees
something is wrong — otherwise the original error propagates untouched.

Implementations of `ConnectivityPort` must resolve their backing state _inside_
the method body: the client is bound at module scope, before an app's reactive
store or context exists.

```typescript
// src/firebase/connectivity.ts
import {
  ConnectionStatus,
  withConnectivityHandling,
} from 'firebase-kit-client/connectivity'
import type {
  ConnectivityHandlingDependencies,
  ConnectivityPort,
} from 'firebase-kit-client/connectivity'

let status = ConnectionStatus.Online

/** What the app renders from. A real app keeps this in a store or context. */
export const getConnectionStatus = (): ConnectionStatus => status

const connectivity: ConnectivityPort = {
  markHealthy: () => {
    status = ConnectionStatus.Online
  },

  refreshConnectionStatus: async () => {
    if (!navigator.onLine) {
      status = ConnectionStatus.Offline

      return status
    }

    const reachable = await fetch('/healthz')
      .then((response) => response.ok)
      .catch(() => false)

    // Navigator claims online but our backend did not answer.
    status = reachable
      ? ConnectionStatus.Online
      : ConnectionStatus.ServicesUnavailable

    return status
  },
}

const dependencies: ConnectivityHandlingDependencies = {
  isClient: typeof window !== 'undefined',
  connectivity,
  isPotentialConnectivityErrorCode: (code) =>
    code === 'functions/deadline-exceeded' ||
    code === 'functions/internal' ||
    code === 'unavailable',
}

/** Bind once, then hand the same value to every caller and Firestore layer. */
export const callWithConnectivity = <T>(
  serviceCall: () => Promise<T>,
): Promise<T> => withConnectivityHandling(dependencies, serviceCall)
```

### `firebase-kit-client/callable`

One caller per callable group. The group's command map is a type argument, so
the response type follows the action: `await callSpaces('get-space', { spaceId })`
is `{ name: string }` with no cast.

The map has to be an `interface` that extends `RequestResponseMap` — an
interface only satisfies the caller's constraint by inheriting that index
signature.

Every host coupling arrives already bound in `dependencies`, so the same
connectivity policy and the same rate-limit budget cover the callables and the
direct Firestore reads.

```typescript
// src/firebase/callSpaces.ts
import {
  createActionableFunctionCaller,
  toActionableError,
} from 'firebase-kit-client/callable'
import type {
  ActionableFunctionCallerDependencies,
  RequestResponseMap,
} from 'firebase-kit-client/callable'
import { callWithConnectivity } from './connectivity.js'
import { createError } from './errors.js'
import { checkRateLimit } from './rateLimit.js'
import type { RateLimitCategory } from './rateLimit.js'

const CurrentAPIVersion = 7

type SpacesCommand = 'get-space' | 'rename-space'

interface SpacesMap extends RequestResponseMap {
  'get-space': [{ spaceId: string }, { name: string }]
  'rename-space': [{ spaceId: string; name: string }, { result: string }]
}

const dependencies: ActionableFunctionCallerDependencies<RateLimitCategory> = {
  currentAPIVersion: CurrentAPIVersion,
  checkRateLimit,
  withConnectivityHandling: callWithConnectivity,
  // Connectivity errors pass through untouched; everything else becomes fatal.
  toActionableError: (error, message) =>
    toActionableError(createError, error, message),
  // undefined binds the default app and the default region.
  firebaseApp: undefined,
  // Set this instead for a non-default region or a custom domain.
  functions: undefined,
}

export const callSpaces = createActionableFunctionCaller<
  SpacesCommand,
  SpacesMap,
  RateLimitCategory
>(dependencies, 'spaces', 'default', {
  timeoutMs: 30_000,
  rateLimitMap: { 'rename-space': 'expensive' },
})
```

Calling it stamps `v`, checks the rate limit, strips `undefined` properties
through a JSON round trip (so the SDK never turns them into `null`), and revives
any `Timestamp` in the response:

```typescript
// src/spaces/renameSpace.ts
import { callSpaces } from '../firebase/callSpaces.js'

export const renameSpace = async (
  spaceId: string,
  name: string,
): Promise<string> => {
  const response = await callSpaces('rename-space', { spaceId, name })

  return response.result
}
```

### `firebase-kit-client/firestore`

`createFirestoreUtils` is called once, from the app's own database barrel, and
returns the whole browser-side read layer already bound: `getDoc`, `getDocs`,
`getDocsWithCursor`, the cached `getDocWithCache` / `getDocsWithCache`, the two
subscriptions `subscribe` / `subscribeWithCache`, the shared `readThroughCache`,
and `getHostingFirestore`, which picks between the full and lite SDKs and between
the named and default databases.

Pass it the same `withConnectivityHandling` the callable caller got — that is
what makes a direct read degrade exactly like a callable response.

```typescript
// src/firebase/db.ts
import { createFirestoreUtils } from 'firebase-kit-client/firestore'
import { callWithConnectivity } from './connectivity.js'
import { isDev } from './hosting.js'

/** Bumping this invalidates every cached collection at once. */
const CacheVersion = 1

export const db = createFirestoreUtils({
  // The app's named database in production; undefined — the project default —
  // everywhere else. Called per read, since a server render and a browser
  // render of the same build answer differently.
  databaseId: () => (isDev() ? undefined : 'app-database'),
  // Lite-variant reads go through the lite SDK. Return true instead from a
  // test run whose emulator harness only wires up the full one.
  useFullSDK: () => false,
  withConnectivityHandling: callWithConnectivity,
  createLogger: (name) => ({
    log: (...args) => console.log(name, ...args),
    warn: (...args) => console.warn(name, ...args),
    error: (...args) => console.error(name, ...args),
  }),
  cacheVersion: CacheVersion,
})
```

The reads then take a ref or query builder and hand back documents with their id
attached. Build those refs on `db.getHostingFirestore` rather than on a bare
`getFirestore()` from the SDK: it is the only thing that applies the `databaseId`
and `useFullSDK` bound above, so a ref built any other way silently reads the
project's default database through whichever SDK you happened to import. Cached
reads persist through `getsetdel` and are served stale while the connection is
degraded rather than failing:

```typescript
// src/spaces/spaceReads.ts
import { FirestoreVariant } from 'firebase-kit-client/firestore'
import { doc } from 'firebase/firestore/lite'
import type {
  DocumentReference,
  Firestore as FirestoreLite,
} from 'firebase/firestore/lite'
import { db } from '../firebase/db.js'

interface SpaceDoc {
  name: string
}

/**
 * `getHostingFirestore` returns `Firestore | FirestoreLite` — it is the caller
 * that knows which variant it asked for, so narrow it here.
 */
const spaceRef = async (
  id: string,
): Promise<DocumentReference<SpaceDoc, SpaceDoc>> => {
  const firestore = (await db.getHostingFirestore(
    FirestoreVariant.FirestoreLite,
  )) as FirestoreLite

  return doc(firestore, 'spaces', id) as DocumentReference<SpaceDoc, SpaceDoc>
}

/** Straight through. A connectivity failure throws ConnectivityError. */
export const getSpace = (spaceId: string) =>
  db.getDoc<SpaceDoc>({ id: spaceId, getRef: spaceRef })

/**
 * The same read, served from IndexedDB and refreshed once the cached copy is
 * more than an hour old. Offline with a cached copy serves the copy; offline
 * with none throws ConnectivityError.
 */
export const getCachedSpace = (spaceId: string) =>
  db.getDocWithCache<SpaceDoc>({
    name: 'spaces',
    id: spaceId,
    getRef: spaceRef,
    shouldRefresh: (cached) => Date.now() - cached.meta.cachedAt > 3_600_000,
  })
```

`reviveTimestamps` is exported separately for payloads that did not come through
one of the reads above — a value pulled from `localStorage`, say. Pass the
variant matching the SDK whose `Timestamp` class you want back:

```typescript
// src/spaces/revive.ts
import {
  FirestoreVariant,
  reviveTimestamps,
} from 'firebase-kit-client/firestore'

interface StoredSpace {
  name: string
  updated: { seconds: number; nanoseconds: number }
}

export const reviveStoredSpace = (stored: StoredSpace): Promise<StoredSpace> =>
  reviveTimestamps(stored, FirestoreVariant.FirestoreLite)
```

### `firebase-kit-client/testing`

Three factories, each building the stand-in a vitest suite re-exports from a
`__mocks__` module so that a bare `vi.mock('…')` picks it up. Each is called once
at module scope, so every importer shares one registry.

`createFirebaseAppMock` gives an in-memory app registry. `getApp` throws when
nothing has been initialized, exactly as the real module does:

```typescript
// src/__mocks__/firebase/app/index.ts
import { createFirebaseAppMock } from 'firebase-kit-client/testing'

const mock = createFirebaseAppMock()

export const { getApp, getApps, initializeApp, resetFirebaseAppMocks } = mock
```

`createFirebaseFunctionsClientMock` echoes the request payload back instead of
calling a deployed function. A payload carrying `throwInternal` or
`throwFirebaseError` makes the call reject, which is how a caller test drives its
error paths:

```typescript
// src/__mocks__/firebase/functions/index.ts
import { createFirebaseFunctionsClientMock } from 'firebase-kit-client/testing'

const mock = createFirebaseFunctionsClientMock()

export const { getFunctions, httpsCallable, resetFunctionsMocks } = mock
```

`createGetSetDelMock` delegates to the real store — running against whatever
IndexedDB the suite installed — so a test asserts on what was actually stored.
What it adds is the one thing a suite cannot provoke from outside: `failEntriesWith`
arms the reset another tab wiping the store would raise, and `stubStore` takes
the store out of play for the retry-loop cases that need fake timers:

```typescript
// src/__mocks__/getsetdel/index.ts
import { createGetSetDelMock } from 'firebase-kit-client/testing'
import { vi } from 'vitest'

const mock = createGetSetDelMock(
  await vi.importActual<typeof import('getsetdel')>('getsetdel'),
)

export const {
  clear,
  clearEntriesFault,
  createStore,
  del,
  delMany,
  entries,
  failEntriesWith,
  get,
  getMany,
  getMeta,
  GetSetDelResetError,
  handleResetError,
  keys,
  resetGetSetDelMock,
  set,
  setMany,
  setMeta,
  stubStore,
} = mock
```

A test file then declares `vi.mock('firebase/app')` (or `'firebase/functions'`,
or `'getsetdel'`) and imports the extra helpers — `resetFirebaseAppMocks`,
`failEntriesWith` and the rest — from the `__mocks__` module directly, since the
real modules do not declare them.

## API Reference

### `firebase-kit-client`

- **`getErrorWithCode(error)`**: Unwraps a thrown value down to the first `code`
  string it carries, walking the `cause` chain. Returns
  `{ error, code, details }`, or all three as `undefined` when nothing in the
  chain has a code.
- **`CreateErrorFunction`**: `(options: { message, cause?, fatal? }) => Error` —
  the injected error factory the callable layer builds fatal errors through.

### `firebase-kit-client/callable`

- **`createActionableFunctionCaller<TCommand, TMap, TRateLimitCategory>(dependencies, name, defaultCategory, options?)`**:
  Returns `(action, data) => Promise<response>` for one callable group.
- **`toActionableError(createError, error, message)`**: Returns a
  `ConnectivityError` untouched, and builds a fatal error out of anything else.
- **`RequestResponseMap`**, **`ActionableFunctionCallerOptions`** (`timeoutMs`,
  `rateLimitMap`), **`ActionableFunctionCallerDependencies`**.

### `firebase-kit-client/connectivity`

- **`withConnectivityHandling(dependencies, serviceCall)`**: Runs the call,
  marks the connection healthy on success, and converts a classified failure
  into a `ConnectivityError` when the probe confirms a degraded status.
- **`ConnectivityError`**: Carries `status`, one of the degraded
  `ConnectionStatus` values.
- **`ConnectionStatus`**: `Online`, `Offline`, `Unstable` (navigator claims
  online, nothing loads), `ServicesUnavailable` (internet reachable, backend
  health check failed).
- **`ConnectivityStatus`**, **`ConnectivityPort`**,
  **`ConnectivityHandlingDependencies`**.

### `firebase-kit-client/firestore`

- **`createFirestoreUtils(dependencies)`**: Returns `getDoc`, `getDocWithCache`,
  `getDocs`, `getDocsWithCache`, `getDocsWithCursor`, `getHostingFirestore`,
  `readThroughCache`, `subscribe` and `subscribeWithCache`, all bound.
- **`FirestoreUtils`**: The type of that return value, so a module that receives
  the bound layer can name it in a signature.
- **`reviveTimestamps(value, variant)`**: Rebuilds `Timestamp` instances from
  plain `{ seconds, nanoseconds }` (or callable-style `_seconds` /
  `_nanoseconds`) objects, walking objects and arrays to any depth.
- **`FirestoreVariant`**: `Firestore` or `FirestoreLite` — which SDK's
  `Timestamp` class to construct.
- **`InvalidTimestampError`**: Thrown when a timestamp-shaped value is missing
  its `seconds` or `nanoseconds`, meaning the cached document or response is
  corrupt rather than stale.
- Option and result types: `ID`, `WithID`, `FirestoreTimestamp`, `Logger`,
  `BaseCacheOptions`, `KeyedCacheOptions`, `CachedDocument`,
  `GetDocWithCacheOptions`, `GetDocsWithCacheOptions`,
  `SubscribeWithCacheOptions`, `SubscribeOptions`, `SubscriptionUpdate`,
  `FirestoreUtilsDependencies`.

### `firebase-kit-client/rate-limit`

- **`createRateLimiter<TRateLimitCategory>(dependencies)`**: Returns
  `(functionName, category) => void`, which records the call and throws once the
  key exceeds its category's window.
- **`RateLimitError`**: `code` is
  `CallableErrorCode.ClientRateLimitExceeded`; `details` carries
  `functionName`, `limit` and `windowMs`.
- **`RateLimitConfig`** (`limit`, `windowMs`), **`RateLimiterDependencies`**
  (`rateLimits`, `isDev`).

### `firebase-kit-client/runtime`

- **`getHostingEnvironment()`**: `Local` for localhost or a private-network
  address, `Live` otherwise — including on a server render.
- **`HostingEnvironment`**: `Local` or `Live`.

### `firebase-kit-client/testing`

- **`createFirebaseAppMock()`**: `{ getApp, getApps, initializeApp, resetFirebaseAppMocks }`.
- **`createFirebaseFunctionsClientMock()`**: `{ getFunctions, httpsCallable, resetFunctionsMocks }`.
- **`createGetSetDelMock(actual)`**: The real `getsetdel` surface plus
  `failEntriesWith`, `clearEntriesFault`, `stubStore` and `resetGetSetDelMock`.

## License

MIT
