# firebase-kit

TypeScript toolkit for Firebase applications, from the browser to Cloud
Functions.

## Packages

This monorepo contains the following packages:

- [firebase-kit-protocol](./packages/firebase-kit-protocol) — the callable
  contract both sides share: request and response types, API versioning, and the
  error codes that cross the wire
- [firebase-kit-client](./packages/firebase-kit-client) — client-side toolkit:
  typed callable functions, cached and subscribed Firestore reads, connectivity
  handling, rate limiting, and vitest doubles
- [firebase-kit-admin](./packages/firebase-kit-admin) — Admin SDK toolkit:
  callable handlers, Firestore transactions, auth checks, task queues, request
  validation, and an emulator test harness

## Features

- 🔗 **One contract, both sides** — the client infers a response type from the
  action it calls, and the handler is checked against the same map
- 📦 **One callable per group** — a single deployed function dispatches on an
  `action` field, with per-action rate limits and API version floors
- 📴 **Offline aware** — connectivity failures surface as a single error type, so
  cached reads can be served instead of a blank page
- 🔒 **Reads and writes kept apart** — a transaction hands back a reader and a
  writer, which is what enforces all-reads-before-any-writes
- 🧪 **Test doubles shipped with the code** — in-memory stand-ins for the
  Firebase SDKs, plus emulator hooks that keep concurrent test files apart
- ✅ **Full TypeScript support** — ESM only, no CommonJS build

## Requirements

- Node.js >= 24
- TypeScript >= 5.0 (for TypeScript users)
- ESM only — these packages ship no CommonJS build

## Maintainers

[`MAINTAINERS.md`](MAINTAINERS.md) covers the one-time npm bootstrap (publishing
the placeholders and configuring trusted publishing) and how to recover a release
that publishes some packages but not others.

## License

MIT
