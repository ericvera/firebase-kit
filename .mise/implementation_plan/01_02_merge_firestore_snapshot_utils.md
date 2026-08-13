# Task 1.2: Merge `firestore-snapshot-utils` into `firebase-kit-admin`

## Goal

Port the `firestore-snapshot-utils` library into `firebase-kit-admin`, write the
colocated tests it has never had, add `jest-diff` as a dependency, and remove
`firestore-snapshot-utils` from the manifest entirely.

**This task must land before the `firebase-admin` 14 upgrade (task 1.3).** It is
what unblocks it — see the ordering note below.

## Requirements addressed

`goals.md` → "Merge `firestore-snapshot-utils` into `firebase-kit-admin`", and
the "The `firebase-admin` 14 peer conflict, and why the merge resolves it"
subsection.

## Background

`firebase-kit` is a Yarn 4 monorepo (`packageManager: yarn@4.18.0`) publishing
`firebase-kit-protocol`, `firebase-kit-client`, and `firebase-kit-admin` from
`packages/`. Tests are Vitest, colocated as `src/<name>.test.ts`; emulator tests
are `src/<name>.emulator.test.ts` and run via `firebase emulators:exec` against
project `demo-admin-tests`. Every Vitest project sets `mockReset: true`. The repo
extends `@tsconfig/strictest`.

**Task 1.1 already landed**, moving five in-range dependencies to new floors
(`eslint` `^10.8.1`, `typescript-eslint` `^8.67.0`, `firebase` `^12.17.1`,
`firebase-functions` `^7.3.2`, `scdate-testing` `^7.1.2`) and updating two README
lines. Nothing else has changed yet: `firebase-admin` is still `^13.10.0` and
`firestore-snapshot-utils` is still `^3.0.1`.

### Why this task comes before the `firebase-admin` upgrade

`firestore-snapshot-utils` declares `peerDependencies: { "firebase-admin":
"^13.5.0" }` — a **required** peer, with no `peerDependenciesMeta`, in **both**
3.0.1 and 4.0.0. No published version accepts `firebase-admin` 14. Yarn reports
only `YN0060`/`YN0086` warnings, so this repo would still build, but a consumer
running the documented `npm install` gets a hard `ERESOLVE` failure.

Removing the dependency removes the cap. Doing it first means the conflicting
pair never coexists in any commit.

### What is being ported

The source is the **local clone at `/Users/eric/Code/firestore-snapshot-utils`**
— verified on 2026-08-13 to be on `main`, clean, at v4.0.0, and byte-identical to
the published v4.0.0 source. Copy from there, not from an unpacked tarball, so
comments and structure survive. It is MIT, same author, 709 LOC across 10 files:

```
src/index.ts                      src/internal/DocumentChangeSnapshot.ts
src/getDBSnapshot.ts              src/internal/ascCompare.ts
src/getDBSnapshotChanges.ts       src/internal/extractTimestamps.ts
src/getDBSnapshotChangesDiff.ts   src/internal/maskProps.ts
src/normalizeData.ts              src/internal/normalizeData.ts
```

Four public functions:

- `getDBSnapshot(queries)` — runs `.get()` on each query, flattens to
  `QueryDocumentSnapshot[]`.
- `getDBSnapshotChanges(beforeDocs, afterDocs, maskKeys = {}, debugOptions = {})`
  — diffs two snapshots into `added` / `removed` / `modified` / `unmodified`.
- `getDiffFromDBSnapshotChanges(changes)` — renders the printable `DB DIFF`
  string.
- `normalizeData(data, options = {})` — replaces Timestamps with
  `/Timestamp XXXX/` (index by chronological order) and Buffers with
  `/Buffer <base64url>/`.

Plus a **type surface that is larger than it looks**. `src/index.ts` ends with
`export type * from './internal/DocumentChangeSnapshot.js'`, so five types are
public today, not one: `DBSnapshotChanges` **and** the four snapshot classes in
type position — `AddedDocumentSnapshot`, `RemovedDocumentSnapshot`,
`ModifiedDocumentSnapshot`, `UnmodifiedDocumentSnapshot`, which are the element
types of `DBSnapshotChanges`' four arrays. A consumer can write `import type
{ ModifiedDocumentSnapshot } from 'firestore-snapshot-utils'` today, so all five
must remain nameable from `firebase-kit-admin/testing` after the merge. The two
public interfaces `DebugOptions` (from `getDBSnapshotChanges.ts`) and
`NormalizeDataOptions` (from `normalizeData.ts`) are also exported by the
library's barrel.

Dropping the four class types would not fail any build — the relative import
inside the shipped `dist` is not gated by the `exports` map — so task 2.1 would
not catch it either. It has to be handled here.

`internal/DocumentChangeSnapshot.ts` is the only file importing `jest-diff`
(`import { diff } from 'jest-diff'`).

### Where it lands

`firebase-kit-admin` already wraps three of those four exports with thin
adapters, all exported from `src/testing/index.ts`:

- `src/testing/getDBSnapshot.ts` — adds the `TestableDBRef` interface (a ref
  object with `testAllQuery()`) and a `SnapshotInput` union, so a suite can
  snapshot by naming refs instead of restating queries, then delegates to the
  library's `getDBSnapshot`.
- `src/testing/getDBChanges.ts` — adds a `TCollection extends string` type
  parameter so masks can be keyed by an app's collection enum, then widens back
  to `Record<string, string[]>` and delegates to `getDBSnapshotChanges`.
- `src/testing/getDBChangesDiff.ts` — a one-line rename delegating to
  `getDiffFromDBSnapshotChanges`.

These three wrappers **become the real implementation** rather than gaining a
layer beneath them. `normalizeData` has no wrapper today and must be added to the
entry point — it is a public library export, and
`src/firestore/createFirestoreUtils.emulator.test.ts` and
`src/firestore/checkDocumentInQueryExists.emulator.test.ts` import it directly
from `'firestore-snapshot-utils'`, so those imports must be repointed.

Three existing unit tests currently `vi.mock('firestore-snapshot-utils', ...)`:
`src/testing/getDBChanges.test.ts`, `getDBChangesDiff.test.ts`, and
`getDBSnapshot.test.ts`. Once the library is in-tree there is no package to mock,
so these must be rewritten against the real implementation.

## Files to modify/create

- `packages/firebase-kit-admin/src/testing/internal/` — **new directory** for the
  ported internals (`DocumentChangeSnapshot.ts`, `ascCompare.ts`,
  `extractTimestamps.ts`, `maskProps.ts`, `normalizeData.ts`).
- `packages/firebase-kit-admin/src/testing/getDBSnapshot.ts`,
  `getDBChanges.ts`, `getDBChangesDiff.ts` — absorb the library implementations.
- `packages/firebase-kit-admin/src/testing/normalizeData.ts` — **new**, the
  ported public `normalizeData`.
- `packages/firebase-kit-admin/src/testing/index.ts` — export `normalizeData`,
  `NormalizeDataOptions`, the `DBSnapshotChanges` type, and the four snapshot
  class types (see step 3).
- Colocated `*.test.ts` for every ported file (see step 4).
- `packages/firebase-kit-admin/src/testing/getDBChanges.test.ts`,
  `getDBChangesDiff.test.ts`, `getDBSnapshot.test.ts` — rewrite, dropping
  `vi.mock('firestore-snapshot-utils', ...)`.
- `packages/firebase-kit-admin/src/firestore/createFirestoreUtils.emulator.test.ts`
  and `checkDocumentInQueryExists.emulator.test.ts` — repoint the `normalizeData`
  import.
- `packages/firebase-kit-admin/package.json` — remove
  `firestore-snapshot-utils` from `peerDependencies`, `peerDependenciesMeta`, and
  `devDependencies`; add `jest-diff` to `dependencies`.
- `packages/firebase-kit-admin/README.md` — delete the
  `firestore-snapshot-utils` optional-peer entry and adjust the install snippet.
- `yarn.lock` — regenerated by `yarn install`.

## Implementation details

1. Copy the five `internal/` files verbatim into
   `packages/firebase-kit-admin/src/testing/internal/`, keeping filenames and
   comments. Fix relative import specifiers (they keep the `.js` extension —
   the repo uses ESM with `"type": "module"`).

2. Fold the three public library functions into the existing wrappers rather than
   keeping a second layer:
   - `getDBSnapshot.ts` — keep `TestableDBRef`, `SnapshotInput`, and
     `isTestableDBRef` exactly as they are; replace the `utilGetDBSnapshot`
     delegation with the library's body (`Promise.all` over `query.get()`, then
     `flatMap` to `.docs`).
   - `getDBChanges.ts` — keep the `TCollection` type parameter and the widening
     cast; inline `getDBSnapshotChanges`' body. Per the overview's assumption 5,
     **do not newly expose** the library's fourth `debugOptions` parameter — keep
     the wrapper's current three-parameter signature. Dropping that parameter has
     three consequences the inlined body must account for, since they are not
     mechanical:
     - **Delete the `DebugOptions` interface** — it becomes unreachable.
     - **Delete the `console.log` block** gated on `debugOptions.logTimestamps`
       (the "Sorted timestamps (chronological order)" dump), and stop building
       `TimestampDebugOptions` objects entirely — call `extractTimestamps(doc.data())`
       with **no second argument**. Its parameter defaults to `{}`, and its only
       use of `docPath` is inside an `if (debugOptions.logTimestamps)` branch that
       is now unreachable, so passing `docPath` would itself be dead code.
     - **The library's `maskKeys: Record<string, string[]> = {}` default
       parameter disappears with the function.** The wrapper passes `masks as
       Record<string, string[]> | undefined`, so the inlined body must apply the
       default itself — `masks ?? {}` — or every call with no masks will hit
       `undefined` where the body expects an object.
   - `getDBChangesDiff.ts` — inline `getDiffFromDBSnapshotChanges`' body.

3. Add `src/testing/normalizeData.ts` with the library's public `normalizeData`
   and its `NormalizeDataOptions` interface. Its `logTimestamps` option **stays**
   — unlike `getDBSnapshotChanges`' `debugOptions`, it is on a signature this
   package is newly exposing, so it is reachable.

   Then export from `src/testing/index.ts`: `normalizeData`,
   `NormalizeDataOptions`, the `DBSnapshotChanges` type, **and the four snapshot
   class types** (`AddedDocumentSnapshot`, `RemovedDocumentSnapshot`,
   `ModifiedDocumentSnapshot`, `UnmodifiedDocumentSnapshot`) — mirroring the
   library's `export type * from './internal/DocumentChangeSnapshot.js'`. All
   five are public today and must stay nameable.

4. **Write colocated tests for everything ported.** The upstream repo has zero
   tests, so this is new coverage, not a port. Follow the repo's Test conventions
   (`src/<name>.test.ts`, colocated). Cover at minimum:
   - `maskProps` — the v4 type-token behavior: masked strings render `/String/`,
     and non-string values render their own type token rather than passing
     through unmasked.
   - `normalizeData` (internal and public) — Timestamps become
     `/Timestamp XXXX/` with the index following chronological order, Buffers
     become `/Buffer <base64url>/`, and nested structures are handled.
   - `extractTimestamps` — collection from nested data.
   - `ascCompare` — ordering.
   - `DocumentChangeSnapshot` classes — `getDiff()` output for added, removed,
     modified, and unmodified.
   - `getDBChanges` — added / removed / modified / unmodified classification,
     and that masks apply per collection.
   - `getDBChangesDiff` — the `DB DIFF` envelope, the section headers, the
     dropped first line on added/removed, and that results are sorted so output
     is stable across runs.
   - `getDBSnapshot` — both `SnapshotInput` shapes (bare `Query` and
     `TestableDBRef`), single and array.

5. Rewrite the three tests that mock the package. They currently assert that the
   wrapper forwards arguments to a mocked library; with the library in-tree,
   assert real behavior instead.

   **Do not preserve `getDBChanges.test.ts`'s `undefined`-vs-`{}` distinction.**
   Its comment claims an empty object would be read as "mask every collection
   with no keys", but `internal/maskProps.ts` does `const keys =
   maskKeys[collection]; if (keys) { … }` — with `{}`, `keys` is `undefined` and
   nothing is masked, exactly as with the library's own `= {}` default. The two
   are behaviorally identical, the existing comment is a misconception, and after
   inlining there is no seam to observe a difference through anyway. Replace those
   cases with real assertions: masks applied per collection, and no masking when
   none are given.

6. Repoint `import { normalizeData } from 'firestore-snapshot-utils'` in the two
   emulator tests to the in-tree module.

7. Update `packages/firebase-kit-admin/package.json`:
   - Remove `firestore-snapshot-utils` from **all three** of
     `peerDependencies`, `peerDependenciesMeta`, and `devDependencies`.
   - Add `"jest-diff": "^30.4.1"` to `dependencies` (which currently holds only
     `firebase-kit-protocol`). A regular dependency, **not** an optional peer —
     per `goals.md`, consumers should install nothing extra.
   - Leave `vitest`'s optional peer marking alone.

8. Run `yarn install`, then `yarn build`, `yarn lint`, `yarn test:unit`, and
   `yarn test:emulator`.

9. Update `packages/firebase-kit-admin/README.md` in two places. Do this
   **before** running the gates in step 8 if you prefer to end on a verified
   state; the README does not affect them either way.

   - Delete the `firestore-snapshot-utils` bullet from the **Optional** peer list
     (currently at `:80`) and drop it from the `npm install --save-dev
     firestore-snapshot-utils vitest` snippet, leaving `vitest`. The surrounding
     prose says "Install both if you use the test harness" — reword for the
     single remaining package.
   - Update the **`### firebase-kit-admin/testing` API-reference section**
     (currently around `:704-717`). It enumerates the entry point's exports down
     to the type level — the bullet
     `**\`getDBSnapshot(inputs)\`**, **\`getDBChanges(before, after, masks?)\`**,
     **\`getDBChangesDiff(changes)\`**` and the trailing types bullet ending
     `**\`TestableDBRef\`**, **\`SnapshotInput\`**`. Add `normalizeData(data,
     options?)` to the functions and `NormalizeDataOptions`,
     `DBSnapshotChanges`, `AddedDocumentSnapshot`, `RemovedDocumentSnapshot`,
     `ModifiedDocumentSnapshot`, and `UnmodifiedDocumentSnapshot` to the types.
     Without this the merge ships seven new public exports with no documentation,
     while task 2.1 asserts `normalizeData` is exposed.

## Testing suggestions

- `yarn test:unit` — the new tests are the bulk of this task's value.
- `yarn test:emulator` — **mandatory.** The two emulator tests whose
  `normalizeData` import moved are
  `src/firestore/createFirestoreUtils.emulator.test.ts` (inline snapshots at
  lines 34 and 61) and `src/firestore/checkDocumentInQueryExists.emulator.test.ts`
  (lines 137 and 168). All four call `normalizeData` **without** masks, so the v4
  type-token change should not reach them — if a snapshot churns anyway,
  regenerate it with Vitest's snapshot update and confirm the new value reflects
  a real formatting change rather than a lost field.
- The repo has no committed `.snap` files, so inline snapshots are the only
  snapshot surface.

## Gotchas

- **Do not upgrade `firebase-admin` in this task.** It is task 1.3. This task
  must end green with `firebase-admin` still at `^13.10.0`.
- **`firestore-snapshot-utils` must be removed from three places** in the
  manifest — `peerDependencies`, `peerDependenciesMeta`, and `devDependencies`.
  Leaving the `peerDependenciesMeta` entry behind is easy to miss and leaves a
  dangling optional marker for a package that is no longer declared.
- **`jest-diff` is a `dependency`, not a `devDependency` or a peer.** It is
  imported by shipped code (`internal/DocumentChangeSnapshot.ts`), so a consumer
  importing `firebase-kit-admin/testing` must get it transitively.
- **The three `vi.mock('firestore-snapshot-utils', ...)` tests will not fail
  loudly** — `vi.mock` of a package that no longer exists can throw at collection
  time, or the mock factory can silently shadow nothing. Rewrite them
  deliberately rather than waiting for the suite to complain.
- **`getDBSnapshotChanges` mutates its inputs**: it calls `.sort()` on
  `beforeDocs` and `afterDocs` directly. That behavior is being ported as-is;
  note it in the tests rather than silently changing it, since changing it is a
  behavior change outside this work's scope.
- **`maskProps` also mutates**, assigning into the object it is handed
  (`obj[key] = getTypeToken(value)`). Safe in production, because it only ever
  receives freshly-built output from `normalizeData` — but a test that reuses a
  fixture object across cases will see cross-contamination. Build fixtures per
  case.
- **Testing `DocumentChangeSnapshot` needs hand-built `QueryDocumentSnapshot`
  doubles** carrying `ref.path`, `ref.parent.id`, `updateTime` (with working
  `isEqual` and `valueOf`), and `data()`. The subcollection path in `getDocPath`
  additionally requires the parent document to be present in the `allDocs` array
  it is given, or it throws. The admin `unit` vitest project has no `setupFiles`
  and does not mock `firebase-admin/firestore`, so real `Timestamp` instances are
  available to build these with.
- The ported code must satisfy `@tsconfig/strictest`, which the upstream repo
  also uses — so it should compile clean, but fix anything that does not at the
  source rather than loosening the config.
- The repo runs `lint-staged` on commit, so committing reformats and re-lints.

## Verification checklist

- [ ] All 10 library files are ported; nothing still imports `'firestore-snapshot-utils'` anywhere in the repo
- [ ] `firestore-snapshot-utils` is gone from `peerDependencies`, `peerDependenciesMeta`, **and** `devDependencies`
- [ ] `jest-diff` `^30.4.1` is in `dependencies` (not dev, not peer)
- [ ] `normalizeData`, `NormalizeDataOptions`, `DBSnapshotChanges`, **and the four snapshot class types** (`AddedDocumentSnapshot`, `RemovedDocumentSnapshot`, `ModifiedDocumentSnapshot`, `UnmodifiedDocumentSnapshot`) are all exported from `firebase-kit-admin/testing`
- [ ] The three wrappers keep their existing public signatures; `debugOptions` is not newly exposed, and the now-unreachable `DebugOptions` interface and `console.log` block were deleted rather than carried across
- [ ] The inlined `getDBChanges` body applies the `masks ?? {}` default that disappeared with the library's default parameter
- [ ] Every ported file has a colocated `*.test.ts`
- [ ] No test still calls `vi.mock('firestore-snapshot-utils', ...)`
- [ ] The two emulator tests import `normalizeData` from the in-tree module
- [ ] `firebase-admin` is still `^13.10.0` — this task does not touch it
- [ ] The admin README no longer lists `firestore-snapshot-utils` as an optional peer or in its install snippet
- [ ] The admin README's `### firebase-kit-admin/testing` API-reference section documents `normalizeData` and the six newly public types
- [ ] `yarn build`, `yarn lint`, `yarn test:unit`, `yarn test:emulator` all pass
- [ ] End-to-end tests: not applicable — the ported code is covered by the new colocated unit tests above, and the config's *consumer-facing wiring* Test exception covers the manifest and README changes, with its substitute verification in task 2.1.
