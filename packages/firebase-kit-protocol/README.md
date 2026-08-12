# firebase-kit-protocol

**The callable contract a Firebase client and its Cloud Functions both compile
against**

[![github license](https://img.shields.io/github/license/ericvera/firebase-kit.svg?style=flat-square)](https://github.com/ericvera/firebase-kit/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/firebase-kit-protocol.svg?style=flat-square)](https://npmjs.org/package/firebase-kit-protocol)

## Overview

A callable function is the one place a browser and a Cloud Function agree on a
shape, and nothing in the Firebase SDKs checks that they still do. This package
is the shared module both sides import: the command-to-`[request, response]` map
a callable group is derived from, the API version envelope that lets a deployed
function keep serving older clients, and the error codes the client reads off a
thrown error to decide what to render.

It is types and enums only — no runtime dependencies, no Firebase SDK import, and
nothing to configure. [`firebase-kit-client`](https://npmjs.org/package/firebase-kit-client)
and [`firebase-kit-admin`](https://npmjs.org/package/firebase-kit-admin) both
depend on it.

## Features

- **One map, five derived types**: A group declares its commands once and reads
  the request, response and handler types off `CallableMap` instead of
  hand-writing the same five aliases per group
- **Payload-free commands work**: A command whose request payload is `undefined`
  yields `{ action: '…' }` rather than collapsing to `never`
- **Versioning built in**: `WithAPIVersion<T>` is the envelope the client stamps
  and the server strips, so a version floor is a compile-time concept
- **Error codes are a wire contract**: `CallableErrorCode` carries the exact
  `code` strings that cross the boundary, including the one the client's own rate
  limiter raises before a call leaves the browser
- **Zero dependencies**: No peer dependencies at all

## Installation

```bash
npm install firebase-kit-protocol
# or
yarn add firebase-kit-protocol
```

There are no peer dependencies. Install it in whichever project imports it
directly — it is already a dependency of `firebase-kit-client` and
`firebase-kit-admin`, but relying on a transitive install is not something either
package promises.

## Requirements

- Node.js >= 24
- TypeScript >= 5.0 (for TypeScript users)
- ESM only — this package ships no CommonJS build

## Entry Points

| Entry point             | What it provides                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `firebase-kit-protocol` | Everything below: `CallableMap`, `WithAPIVersion`, `CallableErrorCode`, `SuccessResult` |

The package has a single entry point. There are no subpaths.

## Usage

### Declaring a callable group

A group is one deployed callable that dispatches on an `action` field. Declare
its commands and their `[request payload, response]` pairs once, then read the
five derived types off `CallableMap`. Both the browser caller and the deployed
handler import this module.

```typescript
// src/protocol/spaces.ts
import type { CallableMap, SuccessResponseData } from 'firebase-kit-protocol'

/** Every action the `spaces` callable dispatches on. */
export type SpacesCommand = 'get-space' | 'rename-space' | 'is-everything-ok'

type SpacesCallable = CallableMap<
  SpacesCommand,
  {
    'get-space': [{ spaceId: string }, { name: string }]
    'rename-space': [{ spaceId: string; name: string }, SuccessResponseData]
    // A command that carries no request payload
    'is-everything-ok': [undefined, SuccessResponseData]
  }
>

/** Request payload of each command, without the action discriminator. */
export type SpacesRequestFor = SpacesCallable['RequestFor']

/** What a handler receives: the action plus its payload. */
export type SpacesActionRequestData = SpacesCallable['ActionRequestData']

/** The version-stamped discriminated union the deployed callable accepts. */
export type SpacesRequestData = SpacesCallable['RequestData']

/** Response of each command, and the union of all of them. */
export type SpacesResponseFor = SpacesCallable['ResponseFor']
export type SpacesResponseData = SpacesCallable['ResponseData']
```

`SpacesRequestData` is `{ action: 'get-space'; spaceId: string; v: number } | { action: 'rename-space'; spaceId: string; name: string; v: number } | { action: 'is-everything-ok'; v: number }`
— note that the payload-free command produces `{ action, v }` rather than
`never`.

### The API version envelope

`WithAPIVersion<T>` adds the `v` field the client stamps onto every request and
the server strips back off. The client's caller
(`firebase-kit-client/callable`) adds it; the server's version guard
(`firebase-kit-admin/callable`) removes it and rejects a version that is missing,
too old, or newer than the server's own.

```typescript
// src/protocol/renameSpaceRequest.ts
import type { WithAPIVersion } from 'firebase-kit-protocol'

export const CurrentAPIVersion = 7

interface RenameSpaceRequest {
  action: 'rename-space'
  spaceId: string
  name: string
}

export const exampleRequest: WithAPIVersion<RenameSpaceRequest> = {
  action: 'rename-space',
  spaceId: 'space-1',
  name: 'Renamed',
  v: CurrentAPIVersion,
}
```

### Success responses and error codes

`SuccessResult` is the single value an outcome-only response carries, and
`SuccessResponseData` is the shape those responses share.
`IsEverythingOKResponseData` and `LogErrorResponseData` are the two ready-made
aliases of it.

`CallableErrorCode` holds the `code` strings that actually cross the boundary.
Handle them by comparing against the enum rather than against a literal — a value
here is a wire contract, so a string literal would drift silently instead of
failing to compile.

```typescript
// src/protocol/outcomes.ts
import { CallableErrorCode, SuccessResult } from 'firebase-kit-protocol'
import type { IsEverythingOKResponseData } from 'firebase-kit-protocol'

export const healthy: IsEverythingOKResponseData = {
  result: SuccessResult.Success,
}

/** Worth retrying: the backend was reached but did not answer in time. */
export const shouldRetry = (code: string | undefined): boolean =>
  code === CallableErrorCode.FunctionsDeadlineExceeded ||
  code === CallableErrorCode.FunctionsInternalError

/** A bug in the caller, not a user-facing condition: never retry it. */
export const isCallerBug = (code: string | undefined): boolean =>
  code === CallableErrorCode.ClientRateLimitExceeded
```

## API Reference

### Types

- **`CallableMap<TCommand, TMap>`**: Derives a callable group's five request and
  response types from its command-to-`[request, response]` map. Members:
  `RequestFor`, `ActionRequestData`, `RequestData`, `ResponseFor`,
  `ResponseData`.

- **`WithAPIVersion<T>`**: `T` plus the `v: number` field. `T` of `undefined`
  yields `{ v: number }` rather than `never`.

- **`SuccessResponseData`**: `{ result: SuccessResult }`. Not meant to be used
  directly — it is the base of response types whose only valid outcome is
  success.

- **`IsEverythingOKRequestData`** / **`IsEverythingOKResponseData`** and
  **`LogErrorRequestData`** / **`LogErrorResponseData`**: The two ready-made
  command contracts. Both requests are `undefined`; both responses are
  `SuccessResponseData`.

### Enums

- **`SuccessResult`**: `Success = 'success'`. The single result an outcome-only
  response carries.

- **`CallableErrorCode`**: The error codes that cross the callable boundary.
  `FunctionsInternalError`, `FunctionsUnauthenticated`,
  `FunctionsPermissionDenied`, `FunctionsFailedPrecondition`,
  `FunctionsDeadlineExceeded` (the client-side timeout elapsing, worth probing
  for connectivity), and `ClientRateLimitExceeded` (raised by the client's own
  guard before the call leaves the browser).

## License

MIT
