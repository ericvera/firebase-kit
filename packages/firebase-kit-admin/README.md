# firebase-kit-admin

**Firebase Admin SDK toolkit: callable handlers, Firestore transactions, auth
checks, task queues, validation, and emulator testing**

[![github license](https://img.shields.io/github/license/ericvera/firebase-kit.svg?style=flat-square)](https://github.com/ericvera/firebase-kit/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/firebase-kit-admin.svg?style=flat-square)](https://npmjs.org/package/firebase-kit-admin)

## Overview

The server half of [firebase-kit](https://github.com/ericvera/firebase-kit) — the
layer a Cloud Functions codebase builds on top of `firebase-admin` and
`firebase-functions`. It covers initialization, the guards every authorized
handler runs before doing any work, a Firestore access layer whose collection
names are checked at compile time, Cloud Tasks enqueueing that survives being
called twice, request validation that turns a schema failure into a readable
`invalid-argument`, and a test harness for running the whole thing against the
emulator.

The Firestore layer is the counterpart of `firebase-kit-client/firestore`: both
take their app's database ids once and hand back an already-bound layer, so
neither side's call sites carry configuration.

## Features

- **Reads and writes kept apart**: `runTransaction` hands the callback a
  separate reader and writer, so which half of a transaction a function is
  allowed to touch is a type rather than a convention — Firestore's
  all-reads-before-any-writes ordering is still the caller's to keep
- **Collection names checked at compile time**: The ref builders take the app's
  collection enums as type arguments, so a query naming a collection the app does
  not have fails to compile
- **Version handshakes, not version guesses**: One guard rejects a request whose
  API version is missing, too old, or newer than the server's; another rejects a
  token whose claims version has drifted, which is the signal a client uses to
  force a refresh
- **Errors that log themselves**: The `internal`, `permission-denied` and
  `invalid-argument` classes log with the caller's uid so they can raise an
  alarm; `unauthenticated` and `failed-precondition` are expected outcomes and
  stay quiet
- **Enqueueing that tolerates a retry**: A task id already scheduled is a
  duplicate of pending work, so it is logged and swallowed rather than raised
- **Emulator testing in one line**: `registerEmulatorHooks` initializes the app
  and installs the hooks that keep concurrent test files, workers and checkouts
  out of each other's data
- **Test doubles included**: In-memory stand-ins for `firebase-admin/app`,
  `/auth`, `/firestore`, `/functions`, `/storage`, and for `firebase-functions`
  and its params module

## Installation

```bash
npm install firebase-kit-admin
# or
yarn add firebase-kit-admin
```

### Peer dependencies

npm will not install these for you. Add them yourself:

```bash
npm install firebase-admin firebase-functions betterbe
```

**Required**

- **`firebase-admin`** (`^13.10.0`) — the Admin SDK. Used by the root entry
  point, `./auth`, `./firestore`, `./tasks` and `./testing`.
- **`firebase-functions`** (`^7.3.2`) — used by `./auth`, `./callable`,
  `./errors`, `./firestore`, `./tasks` and `./validation`. `HttpsError` is the
  base of every error class here.
- **`betterbe`** (`^4.1.0`) — the schema validator `./validation` imports at
  runtime. Required rather than optional: `./validation` is a production entry
  point, so a project that installs this package without `betterbe` will fail at
  import time if it uses it.

**Optional**

- **`vitest`** (`^4.1.10`) — needed only by `firebase-kit-admin/testing` and
  `firebase-kit-admin/mocks`. Nothing on the production entry points imports it.

Install it if you use the test harness:

```bash
npm install --save-dev vitest
```

## Requirements

- Node.js >= 24
- TypeScript >= 5.0 (for TypeScript users)
- ESM only — this package ships no CommonJS build
- A running Firestore/Auth emulator for `firebase-kit-admin/testing`'s emulator
  hooks

## Entry Points

| Entry point                     | What it provides                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firebase-kit-admin`            | `createInit` — the per-app Admin SDK initializer an entry point calls once per cold start                                                                           |
| `firebase-kit-admin/auth`       | `checkAuthenticated` and `checkClaimsVersion`: the two guards an authorized handler runs first                                                                      |
| `firebase-kit-admin/callable`   | `createAPIVersionCheck`, `createOnCallGlobalOptions` and `parseCallableRequest` for grouped callables                                                               |
| `firebase-kit-admin/errors`     | The `HttpsError` subclasses (`internal`, `unauthenticated`, `permission-denied`, `failed-precondition`, `invalid-argument`) plus `getErrorCode` / `getErrorMessage` |
| `firebase-kit-admin/firestore`  | `createFirestoreUtils` — ref builders, `runBatch`, `runTransaction` — plus `checkDocumentExists` and `checkDocumentInQueryExists`                                   |
| `firebase-kit-admin/mocks`      | Factories for the in-memory `firebase-admin` / `firebase-functions` stand-ins a vitest suite installs in `__mocks__`                                                |
| `firebase-kit-admin/runtime`    | `getRuntimeContext`, `inEmulator` and `checkInTestEnvironment`: where this process is actually running                                                              |
| `firebase-kit-admin/tasks`      | `createTaskEnqueuer` — Cloud Tasks enqueueing that skips in the emulator and tolerates a duplicate id                                                               |
| `firebase-kit-admin/testing`    | Request builders, DB snapshot/diff helpers, `expectSuccessResult`, and `registerEmulatorHooks`                                                                      |
| `firebase-kit-admin/validation` | `validateSchemaAndTrim` — a betterbe schema failure turned into a readable `invalid-argument`                                                                       |

## Usage

The examples below build one app's server layer from the bottom up, each file
importing the ones before it. Apart from `./runtime`, `./errors` and
`./validation`, they need an initialized Admin app and a reachable Firestore or
Auth backend — an emulator locally — to actually run. As written they are wiring,
meant to be type-checked and deployed, not executed standalone.

### `firebase-kit-admin/runtime`

Where this process is running, read from environment variables:
`NODE_ENV === 'test'` is `UnitTest`, `FUNCTIONS_EMULATOR === 'true'` is
`Emulator`, and anything else is `Production`.

```typescript
// src/firebase/runtime.ts
import {
  getRuntimeContext,
  inEmulator,
  RuntimeContext,
} from 'firebase-kit-admin/runtime'

/** Deployed code hits real third parties; the emulator and vitest use fixtures. */
export const usesLiveThirdParties = (): boolean =>
  getRuntimeContext() === RuntimeContext.Production

export { inEmulator }
```

`checkInTestEnvironment()` is the guard behind that: it throws unless the process
is a unit-test run, so a test-only helper cannot be shipped into a live app by
accident.

### `firebase-kit-admin`

`createInit` binds the app's project id, buckets and emulator hosts once. The
returned `init` is what the functions entry point calls before any Firestore,
Auth or Storage access — with a service-account credential when deployed and
nothing when running locally. Calling it again after the app exists is a no-op.

```typescript
// src/firebase/init.ts
import { createInit } from 'firebase-kit-admin'
import { inEmulator } from 'firebase-kit-admin/runtime'

export const init = createInit({
  storageBucket: 'my-app.firebasestorage.app',
  emulatorProjectId: 'demo-my-app',
  emulatorStorageBucket: 'demo-my-app.firebasestorage.app',
  // Defaults only: a process that already exported its own emulator host keeps
  // whichever one it configured first.
  emulatorFirestoreHost: '127.0.0.1:8080',
  emulatorAuthHost: '127.0.0.1:9099',
  emulatorStorageHost: '127.0.0.1:9199',
  inEmulator,
})
```

### `firebase-kit-admin/firestore`

`createFirestoreUtils` is called once, from the app's own database barrel, with
the collection enums as type arguments and the database ids as values. It returns
the cached `getFirestore`, the three ref builders every per-collection module sits
on, and the batch and transaction helpers.

```typescript
// src/firebase/db.ts
import { createFirestoreUtils } from 'firebase-kit-admin/firestore'

export enum Collection {
  People = 'people',
  Spaces = 'spaces',
}

export enum SubCollection {
  Entries = 'entries',
}

export const db = createFirestoreUtils<Collection, SubCollection>({
  databaseId: 'app-database',
  // Must stay the default: the Firestore emulator only serves that one.
  emulatorDatabaseId: '(default)',
})
```

Each collection then gets a small ref module built on `collectionDataPoint`
(`subCollectionDataPoint` and `nestedSubCollectionDataPoint` cover one and two
levels of nesting):

```typescript
// src/spaces/spaceRefs.ts
import type {
  CollectionReference,
  Query,
  Timestamp,
} from 'firebase-admin/firestore'
import { Collection, db } from '../firebase/db.js'

export interface DBSpace {
  name: string
  handle: string
  updated: Timestamp
}

const ref = (): CollectionReference<DBSpace, DBSpace> =>
  db.collectionDataPoint<DBSpace>(Collection.Spaces)

export const spaceRefs = {
  doc: (spaceId: string) => ref().doc(spaceId),

  byHandle: (handle: string): Query<DBSpace, DBSpace> =>
    ref().where('handle', '==', handle),

  allQuery: (): Query<DBSpace, DBSpace> => ref(),
}
```

`runTransaction` hands the callback a `TransactionReader` and a
`TransactionWriter` rather than a raw `Transaction`. Neither wrapper exposes the
other's operations, so a helper handed the reader cannot write and a helper
handed the writer cannot read. That is a split of capability, not of ordering:
both wrappers are live from the callback's first line, so a write placed before a
read still compiles and still fails at runtime with Firestore's
all-reads-before-any-writes error. What the split buys is that the order is
legible — you can see which calls are the read phase — and that a function taking
only a `TransactionWriter` cannot quietly add a read later.
`checkDocumentExists` reads through either the reader or the ref itself and
throws `internal` when the document is missing.

```typescript
// src/spaces/renameSpace.ts
import type { AuthData } from 'firebase-functions/tasks'
import { checkDocumentExists } from 'firebase-kit-admin/firestore'
import { db } from '../firebase/db.js'
import { spaceRefs } from './spaceRefs.js'
import type { DBSpace } from './spaceRefs.js'

export const renameSpace = (
  auth: AuthData | undefined,
  spaceId: string,
  name: string,
): Promise<string> =>
  db.runTransaction(async (reader, writer) => {
    const ref = spaceRefs.doc(spaceId)

    // All reads first: Firestore rejects a transaction that reads after a
    // write, and nothing but this ordering prevents it.
    const space = await checkDocumentExists<DBSpace & { id: string }, DBSpace>(
      ref,
      auth,
      reader,
    )

    writer.update(ref, { name })

    return space.id
  })
```

`checkDocumentInQueryExists` is the query-shaped counterpart: it throws when a
query matches more than one document, and returns `undefined` — or throws, if you
pass `errorIfEmpty` — when it matches none. `runBatch` covers pure writes with no
read step.

### `firebase-kit-admin/errors`

Every class extends `firebase-functions`' `HttpsError`, so throwing one is what
the callable protocol expects. The difference is what they log: `internal`,
`permission-denied` and `invalid-argument` log with the caller's uid (so they can
raise an alarm), while `unauthenticated` and `failed-precondition` do not — those
are expected outcomes, not incidents.

```typescript
// src/spaces/createSpace.ts
import { Timestamp } from 'firebase-admin/firestore'
import type { AuthData } from 'firebase-functions/tasks'
import {
  FirebaseAdminErrorCode,
  FunctionsFailedPreconditionError,
  FunctionsInternalError,
  getErrorCode,
  getErrorMessage,
} from 'firebase-kit-admin/errors'
import { spaceRefs } from './spaceRefs.js'

export const createSpace = async (
  auth: AuthData | undefined,
  spaceId: string,
  name: string,
): Promise<void> => {
  try {
    await spaceRefs.doc(spaceId).create({
      name,
      handle: name.toLowerCase(),
      updated: Timestamp.now(),
    })
  } catch (error) {
    if (getErrorCode(error) === FirebaseAdminErrorCode.DocumentAlreadyExists) {
      // Expected: the client retried a create that already landed. Not logged.
      throw new FunctionsFailedPreconditionError(auth, 'Space already exists')
    }

    // Unexpected: logged with the caller's uid so it can raise an alarm.
    throw new FunctionsInternalError(auth, getErrorMessage(error), { spaceId })
  }
}
```

### `firebase-kit-admin/validation`

`validateSchemaAndTrim` runs a [betterbe](https://npmjs.org/package/betterbe)
schema and rejects with `FunctionsInvalidArgumentError` carrying a message a
client can show — `Value of 'name' is too long (maximum length: 60).` rather than
the validator's raw output. It also trims every string in the payload.

```typescript
// src/spaces/schemas.ts
import { object, string } from 'betterbe'
import type { AuthData } from 'firebase-functions/tasks'
import { validateSchemaAndTrim } from 'firebase-kit-admin/validation'

interface RenameSpaceData {
  spaceId: string
  name: string
}

// The type argument is what makes the validated result typed — betterbe's
// validators do not carry their own value type.
const RenameSpaceSchema = object<RenameSpaceData>({
  spaceId: string({ minLength: 1, maxLength: 40 }),
  name: string({ minLength: 1, maxLength: 60 }),
})

export const validateRenameSpace = (
  auth: AuthData | undefined,
  data: unknown,
): Promise<RenameSpaceData> =>
  validateSchemaAndTrim(RenameSpaceSchema, auth, data)
```

### `firebase-kit-admin/callable` and `firebase-kit-admin/auth`

A group is one deployed callable dispatching on an `action` field.
`createOnCallGlobalOptions` builds the shared `onCall` options,
`parseCallableRequest` splits the request into `auth`, `action` and `data` while
preserving the discriminated union (so `data` narrows inside each branch), and
`createAPIVersionCheck` strips the `v` field and rejects a version that is
missing, older than this action's floor, or newer than the server's.

`checkAuthenticated` narrows the optional auth into the `authData` everything
downstream reads. `checkClaimsVersion` loads the caller's stored custom claims
and rejects when the version stamped on the token differs from the stored one in
either direction — the signal the client uses to force a token refresh and retry
— returning the claims so the handler can run its own role checks without a
second Auth round-trip.

```typescript
// src/functions/spaces.ts
import { onCall } from 'firebase-functions/https'
import { checkAuthenticated, checkClaimsVersion } from 'firebase-kit-admin/auth'
import {
  createAPIVersionCheck,
  createOnCallGlobalOptions,
  parseCallableRequest,
} from 'firebase-kit-admin/callable'
import { FunctionsPermissionDeniedError } from 'firebase-kit-admin/errors'
import { createSpace } from '../spaces/createSpace.js'
import { renameSpace } from '../spaces/renameSpace.js'

const CurrentAPIVersion = 7

const checkAPIVersion = createAPIVersionCheck(CurrentAPIVersion)

const onCallOptions = createOnCallGlobalOptions({
  cors: ['https://my-app.example'],
  enforceAppCheck: true,
  region: 'us-east4',
})

type SpacesRequest =
  | { action: 'create-space'; spaceId: string; name: string; v: number }
  | { action: 'rename-space'; spaceId: string; name: string; v: number }

interface AppClaims {
  v?: number
  role?: 'owner' | 'member'
}

export const spaces = onCall<SpacesRequest, Promise<{ result: 'success' }>>(
  onCallOptions,
  async (request) => {
    const { auth, action, data } = parseCallableRequest(request)
    const { authData } = checkAuthenticated(auth)
    const claims = await checkClaimsVersion<AppClaims>(authData)

    // Optional chaining, not decoration: a user who has never had custom
    // claims written has none, and that is what comes back.
    if (claims?.role !== 'owner') {
      throw new FunctionsPermissionDeniedError(authData, 'Owner role required')
    }

    switch (action) {
      case 'create-space': {
        // Clients older than version 5 are rejected here.
        const { spaceId, name } = checkAPIVersion(authData, data, 5)

        await createSpace(authData, spaceId, name)
        break
      }

      case 'rename-space': {
        const { spaceId, name } = checkAPIVersion(authData, data, 7)

        await renameSpace(authData, spaceId, name)
        break
      }
    }

    return { result: 'success' }
  },
)
```

### `firebase-kit-admin/tasks`

`createTaskEnqueuer` absorbs the two outcomes that are not failures. In the
emulator it enqueues nothing, because the Cloud Tasks emulator ignores
`scheduleTime` and would fire a delayed task the moment it is queued. A task id
already scheduled is a duplicate of pending work, so it is logged and swallowed
— which is what makes a repeated enqueue safe. Anything else throws.

```typescript
// src/tasks/enqueueSpaceCleanup.ts
import { inEmulator } from 'firebase-kit-admin/runtime'
import { createTaskEnqueuer } from 'firebase-kit-admin/tasks'

const enqueueTask = createTaskEnqueuer({ inEmulator })

interface SpaceCleanupData {
  spaceId: string
}

export const enqueueSpaceCleanup = (spaceId: string): Promise<void> =>
  enqueueTask<SpaceCleanupData>({
    queueName: 'space-cleanup',
    // Cloud Tasks rejects a second task with this id for about an hour.
    taskId: `space-cleanup-${spaceId}`,
    data: { spaceId },
    delayMs: 60_000,
    dispatchDeadlineSeconds: 300,
    taskName: 'space cleanup',
    logContext: { spaceId },
  })
```

### `firebase-kit-admin/testing`

`registerEmulatorHooks` is normally the only line an app's vitest setup file
needs. It initializes the Firebase app against the emulator and registers three
hooks: a reachability check and a wipe before the file, a wipe plus
`vi.useRealTimers()` before each test, and a wipe after the file. The project id
is derived from `projectIdBase` and `isolationSeed`, so concurrent workers and
two checkouts pointed at one emulator do not wipe each other's data.

```typescript
// src/__test__/setup/emulator.setup.ts
import { registerEmulatorHooks } from 'firebase-kit-admin/testing'

registerEmulatorHooks({
  projectIdBase: 'demo-my-app',
  // Stable per checkout, distinct between checkouts.
  isolationSeed: import.meta.url,
  firestoreHost: '127.0.0.1:8080',
  authHost: '127.0.0.1:9099',
  startInstruction: 'run `yarn test:up`',
})
```

`createRequestBuilders` binds the app's wire configuration once so handler tests
can build a callable request without repeating it. `createTaskRequest` needs no
configuration — a task carries no version envelope — so it is a plain export.

```typescript
// src/__test__/requests.ts
import { createRequestBuilders } from 'firebase-kit-admin/testing'

export const { createCallableRequest, createHandlerRequestData } =
  createRequestBuilders({
    apiVersion: 7,
    appUrl: 'https://my-app.example',
  })
```

An emulator-backed test then snapshots the database before and after the code
under test and pins the printable diff. `getDBChanges` takes per-collection masks
for fields whose values are not stable enough to assert on, keyed by the app's
own collection names. This example needs a running Firestore emulator and the
setup file above.

```typescript
// src/spaces/renameSpace.emulator.test.ts
import {
  getDBChanges,
  getDBChangesDiff,
  getDBSnapshot,
} from 'firebase-kit-admin/testing'
import { expect, it } from 'vitest'
import { renameSpace } from './renameSpace.js'
import { spaceRefs } from './spaceRefs.js'

const refs = [spaceRefs.allQuery()]

it('renames the space', async () => {
  const before = await getDBSnapshot(refs)

  await renameSpace(undefined, 'space-1', 'Renamed')

  const after = await getDBSnapshot(refs)
  const changes = getDBChanges(before, after, { spaces: ['updated'] })

  expect(getDBChangesDiff(changes)).toMatchInlineSnapshot()
})
```

`expectSuccessResult(response)` asserts a handler call resolved with the success
result every outcome-only callable response carries, and
`testGetFirestoreReset()` drops the cached Firestore instance for a unit test
that needs to observe initialization itself (it throws outside a unit-test
environment, so it cannot be shipped by accident).

### `firebase-kit-admin/mocks`

Factories for the in-memory stand-ins a vitest suite re-exports from its
`__mocks__` modules, so that a bare `vi.mock('firebase-admin/app')` picks them up.
Each is called once at module scope, so every importer shares one state.

```typescript
// src/__mocks__/firebase-admin/app/index.ts
import { createFirebaseAdminAppMock } from 'firebase-kit-admin/mocks'

const mock = createFirebaseAdminAppMock()

export const {
  cert,
  getApp,
  getApps,
  getCertifiedConfigs,
  getInitializeAppOptions,
  initializeApp,
  resetFirebaseAdminAppMocks,
} = mock
```

The functions mock is an in-memory Cloud Tasks queue. Task ids are tracked across
enqueues, so a second enqueue of the same id fails the way the real service does
— which is what makes the dedup path in `./tasks` testable — and
`setEnqueueFailure` covers the outcomes the queue itself cannot produce on
demand.

```typescript
// src/__mocks__/firebase-admin/functions/index.ts
import { createFirebaseAdminFunctionsMock } from 'firebase-kit-admin/mocks'

const mock = createFirebaseAdminFunctionsMock()

export const {
  enqueueMock,
  getEnqueuedTasks,
  getFunctions,
  resetFunctionsMock,
  setEnqueueFailure,
  taskQueueMock,
} = mock
```

Some factories need the real module, which the caller obtains with
`vi.importActual`. The Firestore mock hands back the real `FieldPath` and
`Timestamp` and fakes only the query surface; the `firebase-functions` mock
replaces the logger with spies and leaves the function builders real.

```typescript
// src/__mocks__/firebase-admin/firestore/index.ts
import { createFirebaseAdminFirestoreMock } from 'firebase-kit-admin/mocks'
import { vi } from 'vitest'

const mock = createFirebaseAdminFirestoreMock({
  actual: await vi.importActual<typeof import('firebase-admin/firestore')>(
    'firebase-admin/firestore',
  ),
  databaseId: 'app-database',
})

export const {
  FieldPath,
  Timestamp,
  getFirestore,
  initializeFirestore,
  resetFirestoreMock,
} = mock
```

`createFirebaseAdminAuthMock` (an in-memory user directory whose unseeded uids
reject exactly as the real SDK does), `createFirebaseAdminStorageMock` (an
in-memory bucket, plus the individual spies and file-system readers) and
`createFirebaseFunctionsParamsMock` (secrets resolved from a fixture map, strings
from `process.env`) follow the same shape.

## API Reference

### `firebase-kit-admin`

- **`createInit(options)`**: Returns `init(config?)`, which initializes the Admin
  app once — with `cert(config)` when a service account is passed, or against the
  configured emulator hosts when `inEmulator()` is true.
- **`InitOptions`**: `storageBucket`, `emulatorProjectId`,
  `emulatorStorageBucket`, `emulatorFirestoreHost`, `emulatorAuthHost`,
  `emulatorStorageHost`, `inEmulator`.

### `firebase-kit-admin/auth`

- **`checkAuthenticated(auth)`**: Returns `{ authData }`, or throws
  `FunctionsUnauthenticatedError`.
- **`checkClaimsVersion<TClaims>(auth)`**: Loads the caller's stored claims and
  throws `FunctionsPermissionDeniedError` on any version mismatch, or
  `FunctionsInternalError` when the request carries no uid. It returns the
  record as stored, typed `TClaims` — a user who has never had custom claims
  written has none, so read the result defensively.

### `firebase-kit-admin/callable`

- **`createAPIVersionCheck(currentVersion)`**: Returns
  `(auth, data, minVersion) => Omit<data, 'v'>`, throwing `failed-precondition`
  with `currentAPIVersion`, `minVersion` and `clientVersion` in its details.
- **`createOnCallGlobalOptions({ cors, enforceAppCheck, region? })`**: The shared
  `CallableOptions` a group spreads into its function definitions. `region` is
  omitted from the result when not supplied.
- **`parseCallableRequest(request)`**: `{ auth, action, data }`, preserving the
  discriminated union on `action`.

### `firebase-kit-admin/errors`

- **`FunctionsError`**: The base — `HttpsError` plus uid-aware logging.
- **`FunctionsInternalError(auth, message, details?)`** (logs),
  **`FunctionsPermissionDeniedError(auth, message)`** (logs),
  **`FunctionsInvalidArgumentError(auth, message)`** (logs),
  **`FunctionsFailedPreconditionError(auth, message, details?)`**,
  **`FunctionsUnauthenticatedError()`**.
- **`getErrorCode(error)`** / **`getErrorMessage(error)`**: Safe extraction from
  an unknown thrown value.
- **`logInvalidRequest()`**: The warning for an unusable HTTP request.
- **`FirebaseAdminErrorCode`**: `TaskAlreadyExists`, `DocumentAlreadyExists`.

### `firebase-kit-admin/firestore`

- **`createFirestoreUtils<TCollection, TSubCollection>(options)`**: Returns
  `getFirestore`, `collectionDataPoint`, `subCollectionDataPoint`,
  `nestedSubCollectionDataPoint`, `runBatch` and `runTransaction`.
- **`checkDocumentExists(ref, auth, reader?)`**: The document with its `id`, or
  throws `internal`.
- **`checkDocumentInQueryExists(query, options)`**: At most one document. Throws
  on multiple; throws on none only when `errorIfEmpty` is given.
- **`TransactionReader`** / **`TransactionWriter`**: Type-only exports. Both are
  constructed by `runTransaction` and handed to its callback.
- **`FirestoreUtilsOptions`**: `databaseId`, `emulatorDatabaseId`.

### `firebase-kit-admin/mocks`

- **`createFirebaseAdminAppMock()`**, **`createFirebaseAdminAuthMock()`**,
  **`createFirebaseAdminFirestoreMock(options)`**,
  **`createFirebaseAdminFunctionsMock()`**,
  **`createFirebaseAdminStorageMock()`**,
  **`createFirebaseFunctionsMock(options)`**,
  **`createFirebaseFunctionsParamsMock(options)`**.
- **`MockUserRecord`**, **`TaskRecord`**,
  **`FirebaseAdminFirestoreMockOptions`**, **`FirebaseFunctionsMockOptions`**,
  **`FirebaseFunctionsParamsMockOptions`**.

### `firebase-kit-admin/runtime`

- **`getRuntimeContext()`**: `UnitTest`, `Emulator` or `Production`.
- **`inEmulator()`**, **`checkInTestEnvironment()`**, **`RuntimeContext`**.

### `firebase-kit-admin/tasks`

- **`createTaskEnqueuer(dependencies)`**: Returns `enqueue(options)`.
- **`EnqueueTaskOptions`**: `queueName`, `taskId`, `data`, `delayMs`,
  `dispatchDeadlineSeconds`, `taskName`, `logContext`.
- **`TaskEnqueuerDependencies`**: `inEmulator`.

### `firebase-kit-admin/testing`

- **`registerEmulatorHooks(options)`**: Initializes the test app and registers
  the reachability, wipe and teardown hooks.
- **`createRequestBuilders({ apiVersion, appUrl })`**:
  `{ createCallableRequest, createHandlerRequestData }`.
- **`createTaskRequest(data)`**: The request a task handler test feeds in
  directly.
- **`getDBSnapshot(inputs)`**, **`getDBChanges(before, after, masks?)`**,
  **`getDBChangesDiff(changes)`**: The before/after snapshot and printable diff.
- **`normalizeData(data, options?)`**: Replaces Firestore Timestamps with
  `/Timestamp XXXX/` (indexed in chronological order) and Buffers with
  `/Buffer <base64url>/`, so a snapshot assertion stays stable across runs.
- **`expectSuccessResult(response)`**, **`testGetFirestoreReset()`**.
- **`EmulatorHooksOptions`**, **`EmulatorReset`**, **`RequestBuildersOptions`**,
  **`TestableDBRef`**, **`SnapshotInput`**, **`NormalizeDataOptions`**,
  **`DBSnapshotChanges`**, **`AddedDocumentSnapshot`**,
  **`RemovedDocumentSnapshot`**, **`ModifiedDocumentSnapshot`**,
  **`UnmodifiedDocumentSnapshot`**.

### `firebase-kit-admin/validation`

- **`validateSchemaAndTrim(schema, auth, data)`**: Validates against a betterbe
  `ObjectValidator`, rejects with `FunctionsInvalidArgumentError` carrying a
  readable message, and trims every string in the result.

## License

MIT
