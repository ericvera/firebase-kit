# Task 1.2: Upgrade the three majors and fix the fallout

## Goal

Move `firebase-admin` to `^14.2.0`, `firestore-snapshot-utils` to `^4.0.0`, and
`getsetdel` to `^3.0.0` — **replacing** the peer ranges rather than widening them
— fix whatever the new majors break, and update the README lines that quote those
ranges, including deleting a now-obsolete paragraph about the `getsetdel` v2 pin.

This is the task where the risk lives. The two before and after it are
bookkeeping by comparison.

## Requirements addressed

`goals.md` → "Major upgrades (decision 1b: replace the peer range, do not
widen)", plus the `firebase-admin`, `firestore-snapshot-utils`, and `getsetdel`
lines of "Documentation".

## Background

`firebase-kit` is a Yarn 4 monorepo (`packageManager: yarn@4.18.0`, `nodeLinker:
node-modules`) publishing three packages from `packages/`:
`firebase-kit-protocol`, `firebase-kit-client`, and `firebase-kit-admin`. Tests
are Vitest, colocated as `src/<name>.test.ts`; tests needing a live emulator are
`src/<name>.emulator.test.ts` and run via `firebase emulators:exec` against
project `demo-admin-tests`. Every Vitest project sets `mockReset: true`. Shared
fixtures are in `src/__test__/`, module shims in `src/__mocks__/`.

**Task 1.1 already landed** and moved five in-range dependencies to new floors:
`eslint` `^10.8.1` (root + all three packages), `typescript-eslint` `^8.67.0`
(root), `firebase` `^12.17.1` (client peer + dev), `firebase-functions` `^7.3.2`
(admin peer + dev), and `scdate-testing` `^7.1.2` (admin dev). It also updated
`packages/firebase-kit-admin/README.md` for `firebase-functions` and
`packages/firebase-kit-client/README.md` for `firebase`. The suite was green at
the end of it, so anything that breaks in this task is one of the three majors
below.

`typescript` is held at `6.*` and `@types/node` at `24.*` by explicit user
constraint — both are already at the top of their allowed major (`6.0.3`,
`24.13.3`). **Do not widen either**, whatever a new major asks for.

### What each major breaks, and the assessed blast radius

Read from the upstream release notes on 2026-08-13.

**1. `firebase-admin` 13.10.0 → 14.2.0** — the one most likely to force code
changes. Breaking: the Instance ID service is removed, legacy namespace support
is removed, legacy FCM types are dropped, and Node 18/20 support is dropped (a
non-issue — every manifest declares `engines.node: >=24`). Also ships an "error
handling revamp" (v14 #3140) and a fix that reads `CLOUD_TASKS_EMULATOR_HOST` at
construction time rather than at call time (#3167), plus an auth change
decoupling `CreateRequest` from `UpdateRequest` (#3165) and skipping the project
config name assertion under the Auth emulator (#3142).

The repo imports from `firebase-admin/app`, `/auth`, `/firestore`, `/functions`,
and `/storage`. It does not use Instance ID or FCM at all, so those removals are
inert. The surfaces to check:

- `packages/firebase-kit-admin/src/errors/` — eleven files including
  `getErrorCode.ts`, `getErrorMessage.ts`, and five `Functions*Error` classes.
  `getErrorCode.ts` is deliberately structural: it reads a `code` property off an
  `unknown` and stringifies it, so it does not depend on `firebase-admin`'s error
  classes. The error revamp is still worth checking against the
  `Functions*Error` hierarchy, which is built on `firebase-functions`'
  `HttpsError`, not `firebase-admin`'s — likely inert, but confirm.
- `packages/firebase-kit-admin/src/createInit.ts` — sets
  `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, and
  `FIREBASE_STORAGE_EMULATOR_HOST` with `??=` at lines 33-35, then calls
  `initializeApp`. This is the exact pattern #3167 changes the timing of. The
  repo does not set `CLOUD_TASKS_EMULATOR_HOST`, so the specific fix should not
  bite — but if any admin client is now constructed earlier than these
  assignments, the emulator tests are where it shows.
- `packages/firebase-kit-admin/src/__mocks__/firebase-admin/{app,auth,functions}/`
  — hand-written module shims that stand in for the real SDK. Their types are
  pinned to the SDK's, so a type change in v14 surfaces here first, at build time.
- `packages/firebase-kit-admin/src/tasks/createTaskEnqueuer.ts` — the task-queue
  surface, which uses `firebase-admin/functions`.

**2. `firestore-snapshot-utils` 3.0.1 → 4.0.0** — masked property values change
format: masked strings render as `/String/` instead of `••••`, and non-string
values that were previously left unmasked are now replaced by a type token.
Committed snapshots containing masked properties churn and must be regenerated.

Blast radius here is small. The repo has **no committed `.snap` files**. The
`toMatchInlineSnapshot` assertions that go through this library live in
`src/firestore/createFirestoreUtils.emulator.test.ts` (lines 34, 61) and
`src/firestore/checkDocumentInQueryExists.emulator.test.ts` (lines 137, 168), and
all four call `normalizeData(...)` **without** masks, so the format change should
not reach them. The three unit tests that touch the library
(`src/testing/getDBChanges.test.ts`, `getDBChangesDiff.test.ts`,
`getDBSnapshot.test.ts`) each `vi.mock('firestore-snapshot-utils', ...)`, so they
assert against the mock, not the real formatter. If an inline snapshot does churn,
regenerate it rather than editing the expectation by hand.

**3. `getsetdel` 2.0.0 → 3.0.0** — `getMany` now resolves to `(T | undefined)[]`
instead of `T[]`; absent keys have always resolved to `undefined` and the old
declaration was simply wrong. v3 also adds a `getsetdel/testing` subpath with an
in-memory `idb-keyval` backend.

Blast radius is type-surface only. `getMany` appears in exactly one place in the
repo — re-exported from
`packages/firebase-kit-client/src/__mocks__/getsetdel/index.ts:18` — and its
result is never consumed, so no call site needs to start handling `undefined`.

The `getsetdel/testing` and `getsetdel/testing/idb-keyval` subpaths **are in
scope for this work**, but they are **task 1.3, not this task.** This task only
moves the range and keeps the suite green on the existing hand-written mock and
`fake-indexeddb`; task 1.3 then swaps both out. Keeping them apart means this
task ends green on a minimal change and the test-infrastructure swap is
separately revertable.

## Files to modify/create

- `packages/firebase-kit-admin/package.json` — `firebase-admin` and
  `firestore-snapshot-utils` in **both** `devDependencies` and
  `peerDependencies`.
- `packages/firebase-kit-client/package.json` — `getsetdel` in **both**
  `devDependencies` and `peerDependencies`.
- `packages/firebase-kit-admin/README.md` — the `firebase-admin` and
  `firestore-snapshot-utils` peer lines.
- `packages/firebase-kit-client/README.md` — the `getsetdel` install snippet, the
  `getsetdel` peer bullet, and the obsolete "must be major 2" paragraph.
- `yarn.lock` — regenerated by `yarn install`, never hand-edited.
- Whatever source or test files the upgrades force. Expected candidates, in
  descending likelihood: `packages/firebase-kit-admin/src/__mocks__/firebase-admin/*`,
  `packages/firebase-kit-admin/src/tasks/createTaskEnqueuer.ts`,
  `packages/firebase-kit-admin/src/errors/*`. It is a valid outcome for none of
  these to need a change.

## Implementation details

1. Edit the ranges. `peerDependencies` ranges are **replaced**, not widened —
   do not write `^13.10.0 || ^14.2.0`.

   | Package                    | From       | To        | Manifest, blocks                        |
   | -------------------------- | ---------- | --------- | --------------------------------------- |
   | `firebase-admin`           | `^13.10.0` | `^14.2.0` | admin — **peer and dev**                |
   | `firestore-snapshot-utils` | `^3.0.1`   | `^4.0.0`  | admin — **peer (optional) and dev**     |
   | `getsetdel`                | `^2.0.0`   | `^3.0.0`  | client — **peer and dev**               |

   Leave `firestore-snapshot-utils`' entry in `peerDependenciesMeta` marked
   `optional: true`. Leave `vitest`'s optional marking alone too.

2. Run `yarn install` from the repo root. Do not pass `--immutable`.

3. Build first: `yarn build`. Type errors are the expected first signal, and
   `src/__mocks__/firebase-admin/*` is the most likely place they land. Fix them
   at the source — do not add `any`, `@ts-expect-error`, or cast the problem away.
   The repo extends `@tsconfig/strictest`.

4. Run `yarn lint`, then `yarn test:unit`, then `yarn test:emulator`. The
   emulator suite is **required** for this task, not optional: it is the only
   thing that exercises `firebase-admin` against a live Auth and Firestore
   emulator, and the `firebase-admin` 14 upgrade is precisely the change it would
   catch.

5. If an inline snapshot in
   `src/firestore/createFirestoreUtils.emulator.test.ts` or
   `src/firestore/checkDocumentInQueryExists.emulator.test.ts` churns, regenerate
   it with Vitest's snapshot update rather than editing the literal, and sanity
   check that the new value reflects a real formatting change and not a lost
   field.

6. Update `packages/firebase-kit-admin/README.md`:
   - `:68` — `- **`firebase-admin`** (`^13.10.0`)` becomes `(`^14.2.0`)`. Leave
     the "Used by the root entry point, `./auth`, `./firestore`, `./tasks` and
     `./testing`" sentence intact.
   - `:80` — `- **`firestore-snapshot-utils`** (`^3.0.1`)` becomes `(`^4.0.0`)`.
     Leave the "needed only by `firebase-kit-admin/testing`" sentence intact.

7. Update `packages/firebase-kit-client/README.md`:
   - `:57` — the install snippet `npm install firebase 'getsetdel@^2.0.0'`
     becomes `npm install firebase 'getsetdel@^3.0.0'`.
   - `:64` — `- **`getsetdel`** (`^2.0.0`)` becomes `(`^3.0.0`)`.
   - `:67` — **delete the entire paragraph** beginning "**`getsetdel` must be
     major 2.**" and running through "...the conflict fires at install time no
     matter which entry points you go on to import." It documents the v2 pin as a
     deliberate choice and states the range "will move when it is ported" — this
     task is that port, so the paragraph is now false. Delete it and its
     surrounding blank line; do not try to rewrite it into a v3 equivalent, since
     there is no longer a conflict to explain.

## Testing suggestions

No new test file — the config's *consumer-facing wiring* Test exception governs
this work per `goals.md`, and its substitute verification (installing packed
tarballs into a throwaway consumer) is task 2.1. If a major upgrade forces a
behavior change in this repo's own code, extend the **existing** colocated suite
for the file you changed rather than adding a new test file.

- `yarn build` — first and most informative signal; type errors from the
  `firebase-admin` 14 surface land here.
- `yarn lint`
- `yarn test:unit`
- `yarn test:emulator` — **mandatory for this task.** Specifically watch
  `src/firestore/createFirestoreUtils.emulator.test.ts` and
  `src/firestore/checkDocumentInQueryExists.emulator.test.ts` (the four
  `normalizeData` inline snapshots) and any auth-emulator test, given
  `firebase-admin` #3142's change to project config name assertion under the
  emulator.

## Gotchas

- **Each of the three packages appears twice in its manifest** — once in
  `devDependencies`, once in `peerDependencies`. Updating only the dev copy
  leaves the published contract stale and is the single highest-value thing to
  double-check. Grep each manifest per package and confirm two hits.
- **Do not widen the peer ranges.** The confirmed decision is replacement. A
  `||` range here would silently contradict `goals.md`.
- **Do not widen `typescript` past `6.*` or `@types/node` past `24.*`**, even if
  `firebase-admin` 14's own types want a newer `@types/node`. If that turns out to
  be a hard blocker rather than a warning, stop and report it — it contradicts the
  user's explicit constraint and is not a decision to make silently.
- **`firestore-snapshot-utils` must stay optional** in
  `peerDependenciesMeta`. Bumping the range is not a reason to promote it to
  required.
- **Do not adopt `getsetdel/testing` in this task.** It is in scope for the work
  overall, but it is task 1.3. Leave `src/__mocks__/getsetdel/`,
  `src/testing/createGetSetDelMock.ts`, `src/__test__/setup/vi.setup.ts`, and the
  `fake-indexeddb` dev dependency exactly as they are here — this task must end
  green on the existing test infrastructure.
- **`vi.mock('firestore-snapshot-utils', ...)` in three unit tests means those
  tests will pass whether or not the real v4 works.** Do not read their green as
  evidence the upgrade is sound; the emulator tests are what actually exercise
  the library.
- The three unit tests using that mock are `src/testing/getDBChanges.test.ts`,
  `src/testing/getDBChangesDiff.test.ts`, and `src/testing/getDBSnapshot.test.ts`.
  If v4 renamed an export they mock (`getDBSnapshotChanges`,
  `getDiffFromDBSnapshotChanges`, `getDBSnapshot`), the mock factory goes stale
  silently — check the real v4 export names against each `vi.mock` factory.
- The repo runs `lint-staged` on commit, so committing reformats and re-lints.

## Verification checklist

- [ ] `firebase-admin` reads `^14.2.0` in **both** the dev and peer blocks of `packages/firebase-kit-admin/package.json`
- [ ] `firestore-snapshot-utils` reads `^4.0.0` in **both** blocks, and is still `optional: true` in `peerDependenciesMeta`
- [ ] `getsetdel` reads `^3.0.0` in **both** blocks of `packages/firebase-kit-client/package.json`
- [ ] No peer range uses a `||` union — every one was replaced
- [ ] `typescript` still reads `^6.0.3` and `@types/node` still reads `^24.13.3` in every manifest
- [ ] No `any`, `@ts-expect-error`, or new cast was added to silence a v14 type error
- [ ] `getsetdel/testing` was not adopted **in this task** (it is task 1.3); `src/__mocks__/getsetdel/`, `src/testing/createGetSetDelMock.ts`, `src/__test__/setup/vi.setup.ts`, and the `fake-indexeddb` dev dependency are unchanged here
- [ ] `packages/firebase-kit-admin/README.md` quotes `^14.2.0` and `^4.0.0`
- [ ] `packages/firebase-kit-client/README.md` quotes `getsetdel@^3.0.0` in the install snippet and `^3.0.0` in the peer bullet
- [ ] The "**`getsetdel` must be major 2.**" paragraph is gone from `packages/firebase-kit-client/README.md`
- [ ] Each `vi.mock('firestore-snapshot-utils', ...)` factory still names exports that exist in v4
- [ ] End-to-end tests: not applicable — the config's *consumer-facing wiring* Test exception governs, and its substitute verification is task 2.1. This task's gate is `yarn build`, `yarn lint`, `yarn test:unit`, and `yarn test:emulator` all passing, with the emulator suite mandatory.
