# Task 1.3: Upgrade `firebase-admin` to 14

## Goal

Replace the `firebase-admin` peer and dev ranges with `^14.2.0` and fix whatever
the new major breaks.

## Requirements addressed

`goals.md` → "Major upgrades (decision 1b: replace the peer range, do not
widen)", the `firebase-admin` row and its blast-radius item 1.

## Background

`firebase-kit` is a Yarn 4 monorepo (`packageManager: yarn@4.18.0`) publishing
`firebase-kit-protocol`, `firebase-kit-client`, and `firebase-kit-admin` from
`packages/`. Tests are Vitest, colocated as `src/<name>.test.ts`; emulator tests
are `src/<name>.emulator.test.ts` and run via `firebase emulators:exec` against
project `demo-admin-tests`. Every Vitest project sets `mockReset: true`. The repo
extends `@tsconfig/strictest`.

**Tasks 1.1 and 1.2 already landed.** 1.1 moved five in-range dependencies to new
floors. **1.2 merged `firestore-snapshot-utils` into `firebase-kit-admin`** —
porting its 10 source files under `src/testing/` with new colocated tests, adding
`jest-diff` `^30.4.1` as a regular `dependency`, and removing
`firestore-snapshot-utils` from `peerDependencies`, `peerDependenciesMeta`, and
`devDependencies`.

That removal is what makes this task possible: `firestore-snapshot-utils`
declares `firebase-admin: "^13.5.0"` as a **required** peer in every published
version, so while it was a dependency, `firebase-admin` 14 could not be installed
by a consumer without an `ERESOLVE` failure. With it gone, the cap is gone. **If
`firestore-snapshot-utils` still appears anywhere in
`packages/firebase-kit-admin/package.json`, stop — task 1.2 is incomplete and
this task will reintroduce the conflict.**

`typescript` is held at `6.*` and `@types/node` at `24.*` by explicit user
constraint; both are already at the top of their allowed major (`6.0.3`,
`24.13.3`). **Do not widen either**, whatever a new major asks for.

### What `firebase-admin` 14 breaks, and the assessed blast radius

Read from the upstream release notes and PRs on 2026-08-13. Breaking changes in
14.0.0:

1. **Legacy namespaces removed** (#3164) — every `*-namespace.ts` is deleted and
   the root entry point is purely modular. **Inert here:** the repo has zero bare
   `from 'firebase-admin'` imports; everything already uses modular subpaths.
2. **Error handling revamp** (#3140) — exposes all service error classes and the
   base `FirebaseError`, adds `cause` and `HttpResponse` to `ErrorInfo`, moves
   `hasCode()` onto `FirebaseError`, and removes `PrefixedFirebaseError` as an
   intermediate class. **Assessed inert:** the repo references neither
   `PrefixedFirebaseError` nor `hasCode`, and the only `FirebaseError` in the
   repo is imported from `firebase/app` (the *client* SDK) in the client
   package. `src/errors/getErrorCode.ts` reads a `code` property off an `unknown`
   and stringifies it, so it does not depend on the class hierarchy at all. The
   six error classes in `src/errors/` (`FunctionsError.ts` plus five subclasses)
   are built on `firebase-functions`' `HttpsError`, not `firebase-admin`'s.
   Confirm rather than assume.
3. **Instance ID service removed** (#3166) — **inert**, unused.
4. **Legacy FCM types dropped** (#3157) — `DataMessagePayload`,
   `MessagingOptions`, `MessagingPayload`, `NotificationMessagePayload`.
   **Inert**, unused.
5. **Node 18/20 dropped** (#3138), compile target now ES2021 — **inert**, every
   manifest declares `engines.node: ">=24"`.
6. **`@google-cloud/firestore` 7 → 8, transitively.** This is not listed in
   firebase-admin's own release notes, and it is **the largest exposed surface in
   this repo.** `firebase-admin`'s `optionalDependencies` move from
   `"@google-cloud/firestore": "^7.11.0"` (13.10.0) to `"^8.6.0"` (14.2.0), and
   `firebase-admin/firestore` is a re-export of that package. Its v8.0.0
   breaking changes:
   - **`WithFieldValue` and `PartialWithFieldValue` now ignore methods on
     types** (googleapis/nodejs-firestore#2294). A model type carrying methods
     types differently than it did under v7.
   - **`UpdateData<T>` now supports index signatures**
     (googleapis/nodejs-firestore#1953).
   - Node 18 baseline — inert here.

   The repo has **40 import lines** from `firebase-admin/firestore`. The sharpest
   exposure is
   `packages/firebase-kit-admin/src/firestore/internal/TransactionWriter.ts`,
   which imports `Precondition`, `SetOptions`, `Transaction`, `UpdateData`, and
   `WithFieldValue`, and hand-declares structural interfaces that must stay
   assignable from the real `Transaction` / `WriteBatch` — using precisely the two
   types v8 changed. **Expect breakage here first**, not in `src/mocks/`.

Non-breaking changes worth knowing: `CreateRequest` is decoupled from
`UpdateRequest` in auth (#3165, neither is referenced here); the project-config
name assertion is skipped under the Auth emulator (#3142); and
`CLOUD_TASKS_EMULATOR_HOST` is now read at construction time rather than call
time (#3167). 14.2.0 adds TaskQueue Scopes (#3210), which is additive.

Every `firebase-admin`-owned breaking change is therefore inert here — but the
transitive `@google-cloud/firestore` 7 → 8 bump is not, and that is where the
real work of this task most likely is. The surfaces most worth checking, in
descending order:

- `packages/firebase-kit-admin/src/firestore/internal/TransactionWriter.ts` —
  the structural `Transaction` / `WriteBatch` interfaces built on
  `WithFieldValue` and `UpdateData`, both changed by
  `@google-cloud/firestore` 8. **Most likely breakage site.**
- `packages/firebase-kit-admin/src/firestore/internal/` more broadly —
  `TransactionReader.ts`, `createRunTransaction.ts`, `createRunBatch.ts`.
- `packages/firebase-kit-admin/src/mocks/createFirebaseAdminFirestoreMock.ts` —
  the chainable query surface, typed against the same package.
- `packages/firebase-kit-admin/src/mocks/` generally — the **published** mock
  factories,
  and the real `firebase-admin`-typed surface: `createFirebaseAdminAppMock.ts`
  imports values from `'firebase-admin/app'`, and `types.ts` plus the Firestore
  mocks import `FieldPath` / `Timestamp` from `'firebase-admin/firestore'`.
  Type changes in v14 land here first, at build time.
- `packages/firebase-kit-admin/src/createInit.ts` — sets
  `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, and
  `FIREBASE_STORAGE_EMULATOR_HOST` with `??=` at lines 33-35, then calls
  `initializeApp`. This is the pattern #3167 changes the timing of. The repo
  never sets `CLOUD_TASKS_EMULATOR_HOST`, so the specific fix should not bite.
- `packages/firebase-kit-admin/src/tasks/createTaskEnqueuer.ts` — the task-queue
  surface, using `firebase-admin/functions`.
- `packages/firebase-kit-admin/src/__mocks__/firebase-admin/{app,auth,functions}/`
  — thin re-export shims over `src/mocks/` (the auth one is six lines), so they
  are unlikely to be where a type error surfaces.

Import counts across `packages/firebase-kit-admin/src`: `/firestore` ×28,
`/app` ×5, `/auth` ×2, `/functions` ×1. `firebase-admin/storage` is imported
**nowhere** — only the `FIREBASE_STORAGE_EMULATOR_HOST` env var and a doc comment
in `src/mocks/createFirebaseAdminStorageMock.ts` mention storage.

## Files to modify/create

- `packages/firebase-kit-admin/package.json` — `firebase-admin` in **both**
  `devDependencies` and `peerDependencies`.
- `packages/firebase-kit-admin/README.md` — the `firebase-admin` peer line.
- `yarn.lock` — regenerated by `yarn install`.
- Whatever source or test files the upgrade forces. Expected candidates, most
  likely first: `src/firestore/internal/TransactionWriter.ts`, the rest of
  `src/firestore/internal/`, `src/mocks/createFirebaseAdminFirestoreMock.ts`,
  `src/mocks/*`, `src/tasks/createTaskEnqueuer.ts`, `src/errors/*`. It is a valid
  outcome for none of these to need a change, but `TransactionWriter.ts` is the
  one to look at first.

## Implementation details

1. First confirm task 1.2 finished: `firestore-snapshot-utils` must appear
   nowhere in `packages/firebase-kit-admin/package.json`. If it does, stop.

2. Change `firebase-admin` from `^13.10.0` to `^14.2.0` in **both** the
   `peerDependencies` and `devDependencies` blocks of
   `packages/firebase-kit-admin/package.json`. **Replace** the range — do not
   write `^13.10.0 || ^14.2.0`.

3. Run `yarn install` from the repo root. Do not pass `--immutable`. Watch the
   output for any remaining peer warning naming `firebase-admin` — after 1.2
   there should be none.

4. Build first: `yarn build`. Type errors are the expected first signal, most
   likely in `src/mocks/`. Fix them at the source — no `any`, no
   `@ts-expect-error`, no casting the problem away. The repo extends
   `@tsconfig/strictest`.

5. Run `yarn lint`, then `yarn test:unit`, then `yarn test:emulator`. The
   emulator suite is **required** for this task: it is the only thing exercising
   `firebase-admin` against live Auth and Firestore emulators, and this is
   precisely the change it would catch. Pay attention to any auth-emulator test,
   given #3142's change to the project-config name assertion.

6. Update `packages/firebase-kit-admin/README.md:68` — `- **`firebase-admin`**
   (`^13.10.0`)` becomes `(`^14.2.0`)`. Leave the "Used by the root entry point,
   `./auth`, `./firestore`, `./tasks` and `./testing`" sentence intact.

## Testing suggestions

No new test file — the config's *consumer-facing wiring* Test exception governs
per `goals.md`, and its substitute verification is task 2.1. If the upgrade
forces a behavior change in this repo's own code, extend the **existing**
colocated suite for the file changed rather than adding a new test file.

- `yarn build` — first and most informative signal.
- `yarn lint`
- `yarn test:unit`
- `yarn test:emulator` — **mandatory for this task.**

## Gotchas

- **`firebase-admin` appears twice in the manifest** — once in
  `devDependencies`, once in `peerDependencies`. Updating only the dev copy
  leaves the published contract stale. Grep and confirm two hits at `^14.2.0`.
- **Do not widen the peer range.** The confirmed decision is replacement; a `||`
  union would silently contradict `goals.md`.
- **Do not widen `typescript` past `6.*` or `@types/node` past `24.*`,** even if
  `firebase-admin` 14's own types want newer. Note that `typescript-eslint@8.67.0`
  declares `typescript: '>=4.8.4 <6.1.0'`, so 6.0.3 is fine but the ceiling is
  close. If a version constraint turns out to be a hard blocker rather than a
  warning, stop and report it — it contradicts an explicit user constraint and is
  not a decision to make silently.
- **The `src/__mocks__/firebase-admin/*` shims are not where the types live.**
  They are thin re-exports of `src/mocks/`. Look in `src/mocks/` for
  `firebase-admin`-typed surfaces — that is the published entry point with 7
  factories importing from `firebase-admin/app` and `firebase-admin/firestore`.
- **The error revamp is additive, not subtractive, for this repo** — but confirm
  rather than assume. A wrong assumption here surfaces as a runtime error-code
  mismatch in the emulator tests, not at build time.
- **The real breaking change is transitive and unlisted.** `firebase-admin`'s
  release notes do not mention `@google-cloud/firestore` at all, yet its 7 → 8
  bump is what changes `WithFieldValue` and `UpdateData` — the types
  `TransactionWriter.ts` builds its structural interfaces on. Reading only
  firebase-admin's changelog would leave you expecting a free upgrade and
  surprised by a `src/firestore/` type error.
- The repo runs `lint-staged` on commit, so committing reformats and re-lints.

## Verification checklist

- [ ] `firestore-snapshot-utils` appears nowhere in `packages/firebase-kit-admin/package.json` (task 1.2 precondition)
- [ ] `firebase-admin` reads `^14.2.0` in **both** the dev and peer blocks
- [ ] The peer range was replaced, not widened — no `||` union
- [ ] `yarn install` reports no peer warning naming `firebase-admin`
- [ ] `typescript` still reads `^6.0.3` and `@types/node` still reads `^24.13.3` in every manifest
- [ ] No `any`, `@ts-expect-error`, or new cast was added to silence a v14 type error
- [ ] `packages/firebase-kit-admin/README.md` quotes `^14.2.0` for `firebase-admin`
- [ ] `yarn build`, `yarn lint`, `yarn test:unit`, `yarn test:emulator` all pass, with the emulator suite mandatory
- [ ] End-to-end tests: not applicable — the config's *consumer-facing wiring* Test exception governs, and its substitute verification is task 2.1.
