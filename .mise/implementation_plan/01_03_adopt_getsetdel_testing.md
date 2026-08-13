# Task 1.3: Adopt `getsetdel/testing` and drop the local duplicates

## Goal

Replace the repo's hand-written getsetdel test infrastructure with the
equivalents `getsetdel` 3 now ships: delete the local `createGetSetDelMock`
factory in favour of `getsetdel/testing`, and replace `fake-indexeddb` with
`getsetdel/testing/idb-keyval`.

This removes `createGetSetDelMock` from the published
`firebase-kit-client/testing` entry point — a deliberate breaking API change.

## Requirements addressed

`goals.md` → "Adopt `getsetdel/testing` (in scope, by explicit user direction)".

## Background

`firebase-kit` is a Yarn 4 monorepo (`packageManager: yarn@4.18.0`) publishing
`firebase-kit-protocol`, `firebase-kit-client`, and `firebase-kit-admin` from
`packages/`. Tests are Vitest, colocated as `src/<name>.test.ts`, and every
Vitest project sets `mockReset: true`.

**Tasks 1.1 and 1.2 already landed.** 1.1 moved five in-range dependencies to new
floors. 1.2 upgraded three majors — relevant here: **`getsetdel` is now `^3.0.0`
in both the `peerDependencies` and `devDependencies` of
`packages/firebase-kit-client/package.json`**, and the client README already
quotes `^3.0.0`. Task 1.2 deliberately left all test infrastructure untouched, so
the repo currently runs getsetdel 3 against the *old* hand-written mock and
`fake-indexeddb`. That is what this task changes.

### What exists today

- `packages/firebase-kit-client/src/testing/createGetSetDelMock.ts` — a local
  factory wrapping the real getsetdel module, adding `failEntriesWith`,
  `clearEntriesFault`, `stubStore`, and `resetGetSetDelMock`. It destructures
  `queryInventory` out and drops it, with a comment explaining that its signature
  names a type getsetdel does not export, which would make the factory's return
  type unnameable.
- `packages/firebase-kit-client/src/testing/createGetSetDelMock.test.ts` — tests
  for that local factory.
- `packages/firebase-kit-client/src/testing/index.ts` — three lines, one of which
  is `export * from './createGetSetDelMock.js'`. This is the published
  `firebase-kit-client/testing` entry point.
- `packages/firebase-kit-client/src/__mocks__/getsetdel/index.ts` — the shim.
  Calls the local factory once at module scope with
  `await vi.importActual<typeof import('getsetdel')>('getsetdel')`, then
  re-exports 18 destructured members.
- `packages/firebase-kit-client/src/__test__/setup/vi.setup.ts` — a single
  `import 'fake-indexeddb/auto'` with a comment explaining why an IndexedDB is
  needed.
- `packages/firebase-kit-client/vitest.config.ts` — one `unit` project whose
  `root` is `join(import.meta.dirname, 'src')`, with
  `setupFiles: ['./__test__/setup/vi.setup.ts']` and `mockReset: true`. A comment
  records that `root` is `src` rather than the package directory precisely so the
  `__mocks__` folder vitest resolves relative to the root also sits under the
  tsconfig's `rootDir`.

### What getsetdel 3 provides

Verified by unpacking `getsetdel@3.0.0`. Its `exports` map is:

```
"."                       -> ./dist/index.js
"./testing"               -> ./dist/testing/index.js
"./testing/idb-keyval"    -> ./dist/testing/idbKeyval.js
```

`getsetdel/testing` exports `createGetSetDelMock`. It is a **strict superset** of
the local factory — same four controls, plus `simulateStoreReset(storeToken)`
(puts a store into the state another tab wiping it would leave, so reset-guarded
members reject with a genuine `GetSetDelResetError`), and it **keeps
`queryInventory`**, because v3 exports the `GetSetDelInventoryQuery` type whose
absence forced the local copy to drop it.

`getsetdel/testing/idb-keyval` is an in-memory stand-in for `idb-keyval`
(getsetdel's own dependency, `^6.3.0`). It exports the full `idb-keyval` surface
plus `testClearMockIndexedDB()` and `testGetMockIndexedDBData()`.

The shim's location is already correct: getsetdel's documentation requires the
`__mocks__` directory to sit at the **vitest project root**, and this project's
root is `src`, so `src/__mocks__/getsetdel/` is exactly right. **No file moves.**

## Files to modify/create

- `packages/firebase-kit-client/src/testing/createGetSetDelMock.ts` — **delete**.
- `packages/firebase-kit-client/src/testing/createGetSetDelMock.test.ts` —
  **delete** (it tests the deleted factory; the upstream factory is tested
  upstream).
- `packages/firebase-kit-client/src/testing/index.ts` — drop the
  `createGetSetDelMock` re-export line.
- `packages/firebase-kit-client/src/__mocks__/getsetdel/index.ts` — import the
  factory from `getsetdel/testing`; add the two newly available members to the
  re-export list.
- `packages/firebase-kit-client/src/__test__/setup/vi.setup.ts` — swap
  `fake-indexeddb` for the getsetdel backend, add the `beforeEach` reset.
- `packages/firebase-kit-client/vitest.config.ts` — add `server.deps.inline`.
- `packages/firebase-kit-client/package.json` — remove the `fake-indexeddb`
  devDependency.
- `packages/firebase-kit-client/README.md` — four places (see step 7).
- `yarn.lock` — regenerated by `yarn install`.

## Implementation details

1. Rewrite `src/__mocks__/getsetdel/index.ts` to source the factory from
   `getsetdel/testing` instead of `../../testing/index.js`. Keep the existing
   shape exactly: one module-scope call, `await vi.importActual<typeof
   import('getsetdel')>('getsetdel')` as the argument, then a destructured
   re-export. Keep the existing NOTE comment about calling it once at module
   scope so every importer shares one fault switch — it is still the reason the
   shim works. Extend the re-export list with the two members the local factory
   could not provide: **`queryInventory`** and **`simulateStoreReset`**.

2. Delete `src/testing/createGetSetDelMock.ts` and
   `src/testing/createGetSetDelMock.test.ts`, and remove the
   `export * from './createGetSetDelMock.js'` line from `src/testing/index.ts`.
   Leave the other two exports (`createFirebaseAppMock`,
   `createFirebaseFunctionsClientMock`) alone.

3. Rewrite `src/__test__/setup/vi.setup.ts`. It must mock `idb-keyval` — which is
   *getsetdel's* dependency, not this repo's — and clear the backend before each
   case, because the in-memory backend holds data in module scope and would leak
   between cases. Preserve the spirit of the existing comment: explain that the
   Firestore cache layer stores through getsetdel, which wraps `idb-keyval`,
   which needs an IndexedDB that neither Node nor happy-dom provides — and that
   mocking the transitive dependency is what leaves getsetdel itself real. Use
   `vi.mock('idb-keyval', async () => import('getsetdel/testing/idb-keyval'))`
   and a `beforeEach(() => { testClearMockIndexedDB() })`.

4. Add `server.deps.inline: ['getsetdel']` to the `unit` project in
   `packages/firebase-kit-client/vitest.config.ts`. **This is required, not
   optional.** Vitest externalizes packages resolved from `node_modules`, so
   without inlining, getsetdel's own `import 'idb-keyval'` resolves natively and
   never sees the mock — the first `createStore` fails with `ReferenceError:
   indexedDB is not defined` raised from inside `node_modules/idb-keyval`.
   Comment it, because the failure mode is confusing enough to invite someone
   deleting the line later.

5. Remove `fake-indexeddb` from `devDependencies` in
   `packages/firebase-kit-client/package.json`, then run `yarn install` from the
   repo root. Do not pass `--immutable`.

6. Run `yarn build`, `yarn lint`, then `yarn test:unit`. The client package has no
   emulator tests, but run `yarn test:emulator` anyway to confirm the admin
   package is unaffected.

7. Update `packages/firebase-kit-client/README.md`:
   - `:82-83` — the guidance to "install `fake-indexeddb` as a devDependency and
     import `fake-indexeddb/auto` from your vitest setup file" is now wrong.
     Replace it with the getsetdel backend setup: `vi.mock('idb-keyval', ...)`
     pointing at `getsetdel/testing/idb-keyval`, the `beforeEach`
     `testClearMockIndexedDB()`, and the `server.deps.inline: ['getsetdel']`
     requirement. No `fake-indexeddb` install is needed at all any more.
   - `:103` — the entry-point table row for `firebase-kit-client/testing` lists
     three factories including `createGetSetDelMock`. Drop it from that list,
     leaving `createFirebaseAppMock` and `createFirebaseFunctionsClientMock`.
   - `:481-492` — the worked example imports `createGetSetDelMock` from
     `'firebase-kit-client/testing'`. Repoint it at `'getsetdel/testing'`. The
     surrounding prose about delegating to the real store still holds.
   - `:598` — the API-reference bullet for `createGetSetDelMock(actual)`. Either
     remove it or restate it as a pointer to `getsetdel/testing`, since the
     factory is no longer this package's API.

## Testing suggestions

No new test file — the config's *consumer-facing wiring* Test exception governs
this work per `goals.md`, and the substitute verification for the changed
`./testing` entry point is task 2.1, which installs the packed tarball and runs
the README snippets.

- `yarn test:unit` is the real gate here. The cached-Firestore-read suites are
  what actually exercise the swapped backend: `src/firestore/internal/
  getDocWithCache.test.ts`, `getDocsWithCache.test.ts`, and
  `subscribeWithCache.test.ts`. The latter two import the fault controls from
  `../../__mocks__/getsetdel/index.js` and call `vi.mock('getsetdel')`.
- Deleting `src/testing/createGetSetDelMock.test.ts` lowers the repo's test count.
  That is expected and correct — it tested a factory that no longer exists here.
  Do not port those cases onto the upstream factory; that would be testing
  someone else's library.

## Gotchas

- **`server.deps.inline: ['getsetdel']` is load-bearing.** Omitting it produces
  `ReferenceError: indexedDB is not defined` from inside `node_modules`, which
  looks like a missing polyfill and invites re-adding `fake-indexeddb` — the
  exact wrong fix.
- **Do not move the `__mocks__` directory.** It looks like it should be at the
  package root next to `node_modules`, but vitest resolves it against the
  *project root*, which `vitest.config.ts` sets to `src`. The existing location
  is already correct, and the config comment explains why. Moving it silently
  breaks `vi.mock('getsetdel')` into automocking, which fails as a confusing
  assertion error rather than a wiring error.
- **`mockReset: true` does not clear the in-memory backend.** It resets vitest
  mock functions; the getsetdel backend keeps its data in module scope. The
  `beforeEach(testClearMockIndexedDB)` is what makes cases independent, and
  without it a case reads data a previous case wrote.
- **The factory must stay a single module-scope call.** Fault state is private
  per `createGetSetDelMock` call, so calling it inside a test or helper would
  give the test and the code under test different switches, and arming a fault
  would silently do nothing.
- **Removing `createGetSetDelMock` from `./testing` is a public API removal.**
  That is intended, and the release is already breaking because of the peer-range
  replacement in task 1.2. Do not leave a deprecated re-export shim behind.
- `queryInventory` and `simulateStoreReset` are additions to the shim's
  re-export list. Nothing in the repo consumes them yet; export them anyway so
  the shim mirrors the full upstream surface, which is the shim's whole job.
- The repo runs `lint-staged` on commit, so committing reformats and re-lints.

## Verification checklist

- [ ] `packages/firebase-kit-client/src/testing/createGetSetDelMock.ts` and `createGetSetDelMock.test.ts` are deleted
- [ ] `src/testing/index.ts` no longer re-exports `createGetSetDelMock` and still exports the other two factories
- [ ] `src/__mocks__/getsetdel/index.ts` imports `createGetSetDelMock` from `getsetdel/testing`, still calls it exactly once at module scope, and re-exports `queryInventory` and `simulateStoreReset` alongside the existing members
- [ ] `src/__test__/setup/vi.setup.ts` mocks `idb-keyval` with `getsetdel/testing/idb-keyval` and calls `testClearMockIndexedDB()` in a `beforeEach`
- [ ] `vitest.config.ts` sets `server.deps.inline: ['getsetdel']` on the `unit` project, with a comment explaining why
- [ ] `fake-indexeddb` appears nowhere in the repo — not in `package.json`, not in source, not in the README
- [ ] The `__mocks__` directory was **not** moved
- [ ] `packages/firebase-kit-client/README.md` documents the getsetdel backend setup, drops `createGetSetDelMock` from the `./testing` entry-point table row, and points the worked example at `getsetdel/testing`
- [ ] `yarn build`, `yarn lint`, `yarn test:unit`, `yarn test:emulator` all pass
- [ ] End-to-end tests: not applicable — the config's *consumer-facing wiring* Test exception governs, and its substitute verification (packed-tarball consumer install, exercising the now-smaller `./testing` entry point) is task 2.1.
