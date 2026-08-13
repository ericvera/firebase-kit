# Task 1.5: Adopt `getsetdel/testing` and rename the client's `./testing` to `./mocks`

## Goal

Two changes to the same entry point, done together:

1. Replace the repo's hand-written getsetdel test infrastructure with what
   `getsetdel` 3 ships — delete the local `createGetSetDelMock` in favour of
   `getsetdel/testing`, and replace `fake-indexeddb` with
   `getsetdel/testing/idb-keyval`.
2. Rename the published `firebase-kit-client/testing` subpath to
   `firebase-kit-client/mocks`.

They are one task because both rewrite `packages/firebase-kit-client/src/testing/`,
the package's `exports` map, and the same client-README sections. Splitting them
means editing the same prose twice and briefly shipping an entry point whose name
and documentation disagree.

## Requirements addressed

`goals.md` → "Adopt `getsetdel/testing` (in scope, by explicit user direction)"
and "Rename `firebase-kit-client/testing` → `firebase-kit-client/mocks`".

## Background

`firebase-kit` is a Yarn 4 monorepo (`packageManager: yarn@4.18.0`) publishing
`firebase-kit-protocol`, `firebase-kit-client`, and `firebase-kit-admin` from
`packages/`. Tests are Vitest, colocated as `src/<name>.test.ts`. Every Vitest
project sets `mockReset: true`. The repo extends `@tsconfig/strictest`.

**Tasks 1.1 through 1.4 already landed.** Relevant here: **task 1.4 moved
`getsetdel` to `^3.0.0`** in both the `peerDependencies` and `devDependencies` of
`packages/firebase-kit-client/package.json`, and updated the client README's
install snippet and peer bullet. Task 1.4 deliberately left every piece of test
infrastructure untouched, so the repo currently runs getsetdel 3 against the
*old* hand-written mock and `fake-indexeddb`. That is what this task changes.

### Why the rename

`firebase-kit-admin` splits its two test-related entry points by kind: `./mocks`
holds module shims for `vi.mock` (7 `create*Mock` factories), and `./testing`
holds helpers — request builders, `expectSuccessResult`, DB snapshot/diff, and
emulator lifecycle hooks.

`firebase-kit-client/testing` holds only `create*Mock` factories:
`createFirebaseAppMock`, `createFirebaseFunctionsClientMock`, and
`createGetSetDelMock`. Once this task deletes the last of those, it is *entirely*
mocks with zero helpers — which in the admin package would live under `./mocks`.
The rename makes identical things carry identical names across both packages.

No compatibility alias is kept: the release is already breaking, and the entry
point is being rewritten here anyway.

### What exists today

- `packages/firebase-kit-client/src/testing/createGetSetDelMock.ts` — a local
  factory wrapping the real getsetdel module, adding `failEntriesWith`,
  `clearEntriesFault`, `stubStore`, and `resetGetSetDelMock`. It destructures
  `queryInventory` out and drops it, with a comment explaining that its signature
  names a type getsetdel did not export.
- `packages/firebase-kit-client/src/testing/createGetSetDelMock.test.ts` — tests
  for that local factory.
- `packages/firebase-kit-client/src/testing/index.ts` — exactly three lines,
  re-exporting `createFirebaseAppMock`, `createFirebaseFunctionsClientMock`, and
  `createGetSetDelMock`.
- `packages/firebase-kit-client/src/__mocks__/getsetdel/index.ts` — the shim.
  Calls the local factory once at module scope with `await
  vi.importActual<typeof import('getsetdel')>('getsetdel')`, then re-exports 18
  destructured members.
- `packages/firebase-kit-client/src/__test__/setup/vi.setup.ts` — a single
  `import 'fake-indexeddb/auto'` plus a comment explaining why an IndexedDB is
  needed.
- `packages/firebase-kit-client/vitest.config.ts` — one `unit` project whose
  `root` is `join(import.meta.dirname, 'src')`, with
  `setupFiles: ['./__test__/setup/vi.setup.ts']` and `mockReset: true`. A comment
  records that `root` is `src` rather than the package directory precisely so the
  `__mocks__` folder vitest resolves relative to the root also sits under the
  tsconfig's `rootDir`.
- `packages/firebase-kit-client/package.json` — `"./testing":
  "./dist/testing/index.js"` in `exports` (line 26). Note that `files` is
  `["dist", "!/**/__test__", "!/**/__mocks__", "!*.test.*"]` — it ships all of
  `dist` and needs **no** edit for this rename. (`"testing"` does appear at line
  14, but that is the `keywords` array, which is unrelated and must be left
  alone.)

### What `getsetdel` 3 provides

Verified against the published package. Its `exports` map:

```
"."                       -> ./dist/index.js
"./testing"               -> ./dist/testing/index.js
"./testing/idb-keyval"    -> ./dist/testing/idbKeyval.js
```

`getsetdel/testing` exports `createGetSetDelMock`. It is a **behavioral
superset** of the local factory: same four controls, plus
`simulateStoreReset(storeToken)`, and it keeps `queryInventory` because v3 exports
the `GetSetDelInventoryQuery` type whose absence forced the local copy to drop it.

Three behavior deltas, all harmless for this repo's current call sites but worth
knowing:

- Upstream `stubStore` stubs **all 13** store-touching members; the local one
  stubs only `createStore`, `entries`, `setMany`, and `delMany`.
- Upstream `failEntriesWith` rejects with the **raw** armed value; the local one
  wraps non-`Error` values in `new Error('getsetdel entries fault', { cause })`.
  All four in-repo call sites pass real `Error`s, so nothing changes today.
- `simulateStoreReset` is **async** and must be awaited — upstream's README warns
  that dropping the `await` makes a case pass for the wrong reason.

`getsetdel/testing/idb-keyval` is an in-memory stand-in for `idb-keyval`
(getsetdel's own dependency), exporting the full surface plus
`testClearMockIndexedDB()` and `testGetMockIndexedDBData()`.

The shim's location is already correct: getsetdel's documentation requires the
`__mocks__` directory to sit at the **vitest project root**, and this project's
root is `src`, so `src/__mocks__/getsetdel/` is exactly right. **No file moves for
the shim.**

## Files to modify/create

**The adoption:**

- `packages/firebase-kit-client/src/testing/createGetSetDelMock.ts` — **delete**.
- `packages/firebase-kit-client/src/testing/createGetSetDelMock.test.ts` —
  **delete**.
- `packages/firebase-kit-client/src/__mocks__/getsetdel/index.ts` — import the
  factory from `getsetdel/testing`; add the two newly available members.
- `packages/firebase-kit-client/src/__test__/setup/vi.setup.ts` — swap
  `fake-indexeddb` for the getsetdel backend; add the `beforeEach` reset.
- `packages/firebase-kit-client/vitest.config.ts` — add `server.deps.inline`.
- `packages/firebase-kit-client/package.json` — remove the `fake-indexeddb`
  devDependency.

**The rename:**

- `packages/firebase-kit-client/src/testing/` → `src/mocks/` (directory rename;
  the remaining two factories and their tests move with it).
- `packages/firebase-kit-client/package.json` — `exports` key `"./testing"` →
  `"./mocks"` pointing at `./dist/mocks/index.js`. **`files` is not touched.**
- `packages/firebase-kit-client/src/__mocks__/firebase/app/index.ts` — imports
  from `'../../../testing/index.js'` and must be repointed at `mocks`.
- `packages/firebase-kit-client/README.md` — nine locations (see step 8).
- `yarn.lock` — regenerated by `yarn install`.

## Implementation details

Do the adoption first, confirm green, then the rename — that way a failure is
attributable to one or the other even though both land in one commit.

1. Rewrite `src/__mocks__/getsetdel/index.ts` to source the factory from
   `getsetdel/testing` instead of `../../testing/index.js`. Keep the existing
   shape exactly: one module-scope call, `await vi.importActual<typeof
   import('getsetdel')>('getsetdel')` as the argument, then a destructured
   re-export. Keep the NOTE comment about calling it once at module scope so
   every importer shares one fault switch — still the reason the shim works.
   Extend the re-export list with **`queryInventory`** and
   **`simulateStoreReset`**.

2. Delete `src/testing/createGetSetDelMock.ts` and its test, and remove the
   `export * from './createGetSetDelMock.js'` line from `src/testing/index.ts`.
   Leave the other two exports.

3. Rewrite `src/__test__/setup/vi.setup.ts`. It must mock `idb-keyval` — which is
   *getsetdel's* dependency, not this repo's — and clear the backend before each
   case, because the in-memory backend holds data in module scope. Preserve the
   spirit of the existing comment: the Firestore cache layer stores through
   getsetdel, which wraps `idb-keyval`, which needs an IndexedDB that neither
   Node nor happy-dom provides, and mocking the transitive dependency is what
   leaves getsetdel itself real. Use `vi.mock('idb-keyval', async () =>
   import('getsetdel/testing/idb-keyval'))` and
   `beforeEach(() => { testClearMockIndexedDB() })`.

   The current file has **no imports at all** — just the bare
   `import 'fake-indexeddb/auto'` — so the rewrite must add them:
   `import { testClearMockIndexedDB } from 'getsetdel/testing/idb-keyval'` and
   `import { beforeEach, vi } from 'vitest'`.

4. Add `server.deps.inline: ['getsetdel']` to the `unit` project in
   `vitest.config.ts`. **Required, not optional.** Vitest externalizes packages
   resolved from `node_modules`, so without inlining, getsetdel's own `import
   'idb-keyval'` resolves natively and never sees the mock — every cached-read
   test then fails with `ReferenceError: indexedDB is not defined` raised from
   inside `node_modules/idb-keyval`. Comment it; the failure mode is confusing
   enough to invite someone deleting the line later.

5. Remove `fake-indexeddb` from `devDependencies`, run `yarn install`, then
   `yarn build`, `yarn lint`, `yarn test:unit`. Confirm green before continuing.

6. Rename the directory `src/testing/` → `src/mocks/`. Use `git mv` so history
   follows. After the deletions in step 2 it contains
   `createFirebaseAppMock.ts`, `createFirebaseAppMock.test.ts`,
   `createFirebaseFunctionsClientMock.ts`,
   `createFirebaseFunctionsClientMock.test.ts`, and `index.ts`.

7. Update `packages/firebase-kit-client/package.json`: change the `exports` key
   `"./testing": "./dist/testing/index.js"` to
   `"./mocks": "./dist/mocks/index.js"`, keeping the key ordering alphabetical to
   match the surrounding entries. **Do not touch `files`** — it is `["dist",
   "!/**/__test__", "!/**/__mocks__", "!*.test.*"]`, which already ships all of
   `dist`, and it contains no `"testing"` entry. Do not touch `keywords` either,
   which does contain a `"testing"` string but is unrelated.

   Then repoint the one remaining intra-repo import of the moved directory —
   `packages/firebase-kit-client/src/__mocks__/firebase/app/index.ts:1`, which
   reads `from '../../../testing/index.js'` — and re-run `yarn build`. (The other
   importer, `src/__mocks__/getsetdel/index.ts`, was already rewritten in step 1.)

8. Update `packages/firebase-kit-client/README.md`. **Locate each edit by the
   quoted anchor text below, not by line number** — task 1.4 deleted a paragraph
   near the top of this file, so every line number shifts by roughly eight, and
   the edits in this step shift each other further. Twelve edits across ten
   locations:

   - The feature bullet reading "**Test doubles included**: In-memory stand-ins
     for `firebase/app`, `firebase/functions` and `getsetdel`, shipped as a
     published entry point" — after this task the package ships no getsetdel
     stand-in, so drop `` and `getsetdel` `` from it. **Note this line contains
     neither of the closing grep strings**, so nothing but this instruction will
     catch it.
   - The `vitest` optional-peer bullet — "needed only by
     `firebase-kit-client/testing`" → `/mocks`.
   - The paragraph beginning "Cached Firestore reads need an IndexedDB
     implementation." and continuing "…a Node test run does not — install
     `fake-indexeddb` as a devDependency and import `fake-indexeddb/auto` from
     your vitest setup file." This guidance is now wrong. Replace the whole
     paragraph with the getsetdel backend setup: `vi.mock('idb-keyval', ...)`
     pointing at `getsetdel/testing/idb-keyval`, the `beforeEach`
     `testClearMockIndexedDB()`, and the `server.deps.inline: ['getsetdel']`
     requirement. No `fake-indexeddb` install is needed at all any more.
   - The entry-point table row whose first cell is
     `` `firebase-kit-client/testing` `` — rename to `/mocks` and drop
     `createGetSetDelMock` from its factory list, leaving `createFirebaseAppMock`
     and `createFirebaseFunctionsClientMock`.
   - **Both** `### firebase-kit-client/testing` headings — one under `## Usage`,
     one in the API reference — → `/mocks`. That is two edits.
   - The sentence "Three factories, each building the stand-in a vitest suite
     re-exports from a `__mocks__` module…" directly under the first of those
     headings — it is **two** factories after this task.
   - The two worked-example imports reading
     `from 'firebase-kit-client/testing'` for `createFirebaseAppMock` and
     `createFirebaseFunctionsClientMock` → `/mocks`. That is two edits.
   - The `createGetSetDelMock` example's import, also
     `from 'firebase-kit-client/testing'` — repoint it at `'getsetdel/testing'`,
     **not** at `/mocks`, since the factory now comes from getsetdel.
   - The prose around that example. It says `createGetSetDelMock` delegates to
     the real store "running against whatever IndexedDB the suite installed",
     which no longer matches the new setup, and that "`failEntriesWith` arms the
     reset another tab wiping the store would raise" — under the upstream factory
     that is `simulateStoreReset`'s job, while `failEntriesWith` merely rejects
     with an armed value. Correct both claims.
   - That example's destructured re-export list must gain `queryInventory` and
     `simulateStoreReset`, so the documented shim matches what step 1 requires of
     the repo's own shim. Task 2.1 runs this snippet verbatim, so a divergence
     here is a real defect.
   - The API-reference bullet for **`createGetSetDelMock(actual)`** — remove it or
     restate it as a pointer to `getsetdel/testing`; it is no longer this
     package's API.

   Finish by grepping the file for `firebase-kit-client/testing` and
   `fake-indexeddb` — both must return zero hits. That grep does **not** cover the
   "Test doubles included" bullet or the "Three factories" sentence; both must be
   checked by eye.

9. Fix four now-false comments in the client test suite. None contains
   `firebase-kit-client/testing` or `fake-indexeddb`, so no grep in this task
   finds them:
   - `src/firestore/internal/getDocWithCache.test.ts:42`,
     `getDocsWithCache.test.ts:111`, and `subscribeWithCache.test.ts:104` each
     read "A distinct store per case, since the in-memory IndexedDB outlives
     them." It stops outliving them once `testClearMockIndexedDB()` runs in
     `beforeEach`.
   - `getMetadata.test.ts:6` reads "No `getsetdel` mock: the setup file installs
     an in-memory IndexedDB" — the setup file now mocks `idb-keyval` instead.

10. Re-run `yarn build`, `yarn lint`, `yarn test:unit`, and `yarn test:emulator`.

## Testing suggestions

No new test file — the config's *consumer-facing wiring* Test exception governs
per `goals.md`, and the substitute verification for both the swapped backend and
the renamed entry point is task 2.1.

- `yarn test:unit` is the real gate for the adoption. Five suites run through the
  swapped backend: `src/firestore/internal/getDocWithCache.test.ts`,
  `getDocsWithCache.test.ts`, `subscribeWithCache.test.ts`,
  `readThroughCache.test.ts`, and `getMetadata.test.ts`. Of those,
  `getDocsWithCache.test.ts` and `subscribeWithCache.test.ts` import the fault
  controls from `../../__mocks__/getsetdel/index.js` and call
  `vi.mock('getsetdel')`.
- `yarn build` is the real gate for the rename — a missed intra-repo import or a
  stale `exports` key surfaces there.
- Deleting `createGetSetDelMock.test.ts` lowers the repo's test count. Expected
  and correct: it tested a factory that no longer exists here. Do not port those
  cases onto the upstream factory; that would be testing someone else's library.

## Gotchas

- **`server.deps.inline: ['getsetdel']` is load-bearing.** Omitting it produces
  `ReferenceError: indexedDB is not defined` from inside `node_modules`, which
  looks like a missing polyfill and invites re-adding `fake-indexeddb` — the
  exact wrong fix.
- **Do not move the `__mocks__` directory.** It looks like it belongs at the
  package root next to `node_modules`, but vitest resolves it against the
  *project root*, which `vitest.config.ts` sets to `src`. The existing location
  is already correct and the config comment explains why. Moving it silently
  turns `vi.mock('getsetdel')` into automocking, which fails as a confusing
  assertion error rather than a wiring error.
- **The `src/testing/` → `src/mocks/` rename is a different directory from
  `src/__mocks__/`.** One is the published entry point; the other is the vitest
  shim directory. They are neighbours with confusingly similar names — renaming
  the wrong one breaks every `vi.mock('getsetdel')` in the package.
- **`getsetdel` 3 ships ~28 compiled test files inside its `dist`.** Inlining the
  package brings them into vitest's module graph. They are inert here — the
  project's `root` is `src` and it excludes `**/node_modules/**`, so they are
  never collected as tests — but do not be alarmed by them appearing in a
  dependency graph or coverage report.
- **`mockReset: true` does not clear the in-memory backend.** It resets vitest
  mock functions; the getsetdel backend holds data in module scope. The
  `beforeEach(testClearMockIndexedDB)` is what makes cases independent.
- **The factory must stay a single module-scope call.** Fault state is private
  per `createGetSetDelMock` call, so calling it inside a test or helper would give
  the test and the code under test different switches, and arming a fault would
  silently do nothing.
- **Two public API removals here, both intended:** `createGetSetDelMock` leaves
  the package, and `./testing` ceases to exist as a subpath. No deprecated
  re-export or alias is left behind for either.
- **Only `exports` changes in the manifest — not `files`.** `files` ships all of
  `dist` and has no per-entry-point listing. There *is* a `"testing"` string at
  line 14, but it is a `keywords` entry; renaming it would silently drop a
  legitimate npm keyword and change nothing about resolution.
- **Edit the README by anchor text, not line number.** Task 1.4 removed a
  paragraph near the top of this same file, so every line number in it has
  already shifted by roughly eight before this task starts.
- The repo runs `lint-staged` on commit, so committing reformats and re-lints.

## Verification checklist

**Adoption:**

- [ ] `src/testing/createGetSetDelMock.ts` and `createGetSetDelMock.test.ts` are deleted
- [ ] The shim imports `createGetSetDelMock` from `getsetdel/testing`, still calls it exactly once at module scope, and re-exports `queryInventory` and `simulateStoreReset` alongside the existing members
- [ ] `src/__test__/setup/vi.setup.ts` mocks `idb-keyval` with `getsetdel/testing/idb-keyval` and calls `testClearMockIndexedDB()` in a `beforeEach`
- [ ] `vitest.config.ts` sets `server.deps.inline: ['getsetdel']` on the `unit` project, with a comment explaining why
- [ ] `fake-indexeddb` appears nowhere in the repo — not in `package.json`, not in source, not in the README
- [ ] `src/__mocks__/` was **not** moved or renamed

**Rename:**

- [ ] `src/testing/` is now `src/mocks/`, moved with `git mv`, containing the two remaining factories, their tests, and `index.ts`
- [ ] `package.json` `exports` has `"./mocks": "./dist/mocks/index.js"` and no `"./testing"` key
- [ ] `package.json` `files` and `keywords` are **unchanged**
- [ ] No compatibility alias or deprecated re-export was left behind
- [ ] `src/__mocks__/firebase/app/index.ts` imports from `../../../mocks/index.js`

**Docs and gates:**

- [ ] All ten client-README locations updated (twelve edits); the `createGetSetDelMock` example points at `getsetdel/testing`, and its destructured list includes `queryInventory` and `simulateStoreReset`
- [ ] The "Three factories" sentence now says two, and the "Test doubles included" bullet no longer names `getsetdel`
- [ ] The four now-false test comments in `getDocWithCache.test.ts`, `getDocsWithCache.test.ts`, `subscribeWithCache.test.ts`, and `getMetadata.test.ts` were corrected
- [ ] The README prose no longer claims `failEntriesWith` simulates a store reset
- [ ] Grepping the client README for `firebase-kit-client/testing` and `fake-indexeddb` returns zero hits
- [ ] `yarn build`, `yarn lint`, `yarn test:unit`, `yarn test:emulator` all pass
- [ ] End-to-end tests: not applicable — the config's *consumer-facing wiring* Test exception governs, and its substitute verification (packed-tarball consumer install exercising the renamed `./mocks` entry point) is task 2.1.
