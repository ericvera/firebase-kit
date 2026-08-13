# Goals — upgrade all npm packages

## Original description

> Upgrade all npm packages. Keep typescript at 6.\* and @types/node at 24.\*

## Current state

Every dependency range in the four `package.json` files was written against the
versions current at the v1.0.0 release. Since then the registry has moved: three
dependencies have published a new major, five have published in-range minor or
patch releases, and the rest are already at their latest.

The two constrained packages are already at the top of their allowed major —
`typescript` latest 6.x is `6.0.3` and `@types/node` latest 24.x is `24.13.3`,
which is exactly what is declared. **Neither changes in this work**, and neither
range may be widened past `6.*` / `24.*`.

Already latest, no change: `@eslint/js`, `@tsconfig/strictest`, `betterbe`,
`fake-indexeddb`, `firebase-tools` (exact pin `15.26.0`), `husky`, `lint-staged`,
`prettier`, `vitest`.

## Desired state

Every remaining dependency sits at its latest published version, and every
declared range — `dependencies`, `devDependencies`, and `peerDependencies` alike
— states that version as its floor.

### Major upgrades (decision 1b: replace the peer range, do not widen)

| Package                    | From      | To        | Declared in                    |
| -------------------------- | --------- | --------- | ------------------------------ |
| `firebase-admin`           | `^13.10.0`| `^14.2.0` | admin: peer + dev              |
| `firestore-snapshot-utils` | `^3.0.1`  | *removed* | admin: peer (optional) + dev   |
| `getsetdel`                | `^2.0.0`  | `^3.0.0`  | client: peer + dev             |

`firestore-snapshot-utils` is **not upgraded** — it is merged into
`firebase-kit-admin` and its dependency is removed entirely. See "Merge
`firestore-snapshot-utils`" below.

#### The `firebase-admin` 14 peer conflict, and why the merge resolves it

Both `firestore-snapshot-utils` 3.0.1 and 4.0.0 declare
`peerDependencies: { "firebase-admin": "^13.5.0" }` — **required**, with no
`peerDependenciesMeta`. So no published version of it accepts `firebase-admin`
14. Yarn only warns (`YN0060`), leaving this repo's own build green, but a
consumer on npm hard-fails with `ERESOLVE` — and that is exactly the install the
README documents.

Merging the library in removes the external dependency, so the cap disappears
and `firebase-admin` `^14.2.0` is unblocked with no upstream release needed.

Peer ranges are **replaced**, not widened — the published packages will require
the new major. Known breaking changes and their assessed blast radius here:

1. **`firebase-admin` 14** — removes the Instance ID service, legacy namespace
   support, and legacy FCM types; drops Node 18/20 (repo declares `>=24`, so this
   is a non-issue). Ships an "error handling revamp" and a fix that reads
   `CLOUD_TASKS_EMULATOR_HOST` at construction time. The repo imports from
   `firebase-admin/app`, `/auth`, `/firestore`, `/functions`, and `/storage`, and
   has its own error-mapping and task-queue surfaces, so **this is the upgrade
   most likely to need code changes** — the error revamp and the Cloud Tasks
   emulator-host timing are the two things to check against
   `firebase-kit-admin`'s error mapping, its `__mocks__/firebase-admin/*`
   modules, and its emulator tests.
2. **`firestore-snapshot-utils`** — superseded by the merge below. The v4 source
   is what gets ported, so the v4 masking change (`••••` → `/String/`, and
   non-string values rendering as a type token) still lands. The repo has no
   committed `.snap` files, and the `toMatchInlineSnapshot` assertions in the
   emulator tests call `normalizeData` without masks, so the repo's own tests
   should be unaffected. The change does alter output for consumers of
   `getDBChanges` / `getDBChangesDiff`.
3. **`getsetdel` 3** — `getMany` now resolves to `(T | undefined)[]` instead of
   `T[]`. The repo only re-exports `getMany` from
   `packages/firebase-kit-client/src/__mocks__/getsetdel/index.ts` and never
   consumes a result, so this is a type-surface change only.

### In-range upgrades (decision 2b: bump every declared range, dev and peer)

| Package             | From       | To         | Declared in                          |
| ------------------- | ---------- | ---------- | ------------------------------------ |
| `eslint`            | `^10.8.0`  | `^10.8.1`  | root + all three packages: dev       |
| `firebase`          | `^12.16.0` | `^12.17.1` | client: peer + dev                   |
| `firebase-functions`| `^7.2.5`   | `^7.3.2`   | admin: peer + dev                    |
| `scdate-testing`    | `^7.0.0`   | `^7.1.2`   | admin: dev                           |
| `typescript-eslint` | `^8.66.0`  | `^8.67.0`  | root: dev                            |

### Merge `firestore-snapshot-utils` into `firebase-kit-admin`

`firebase-kit-admin` already wraps three of the library's four public exports in
near-pass-through adapters (`getDBChangesDiff.ts` is a one-line rename;
`getDBChanges.ts` only widens a type parameter), and the fourth, `normalizeData`,
is used directly by the admin package's own emulator tests. Keeping it as a
separate package buys optionality nobody exercises (~71 downloads/month) while
charging a release-coordination fee on every `firebase-admin` major — the exact
fee being charged right now.

The porting source is the **local clone at
`/Users/eric/Code/firestore-snapshot-utils`** — verified on 2026-08-13 to be on
`main`, clean, at v4.0.0, and byte-identical to the published v4.0.0 source.
Copy from there rather than from an unpacked tarball, so comments and internal
structure come across intact.

It is 10 TypeScript files, 709 LOC, MIT, same author:

```
src/getDBSnapshot.ts              src/internal/DocumentChangeSnapshot.ts
src/getDBSnapshotChanges.ts       src/internal/ascCompare.ts
src/getDBSnapshotChangesDiff.ts   src/internal/extractTimestamps.ts
src/normalizeData.ts              src/internal/maskProps.ts
src/index.ts                      src/internal/normalizeData.ts
```

Scope of the merge:

- Port the v4 source into `firebase-kit-admin`, under the `./testing` entry
  point, folding it into the existing wrappers rather than layering on top of
  them — the wrappers become the real implementation.
- **Re-export `normalizeData`** from `firebase-kit-admin/testing`; it is a public
  export of the library today and the admin emulator tests use it directly.
- **`jest-diff` becomes a regular `dependency`** of `firebase-kit-admin` (used in
  one file, `internal/DocumentChangeSnapshot.ts`). Declared as a plain dependency
  rather than an optional peer so consumers install nothing extra; it ships to
  Functions deployments even for consumers who never import `./testing`, which is
  accepted — ~250KB with `chalk`, `pretty-format` and two `@jest/*` packages, and
  negligible next to `firebase-admin`.
- **Write colocated tests for the ported code.** The upstream repo has **zero**
  tests, so this ports 709 untested lines into a repo whose Test conventions
  mandate colocated `src/<name>.test.ts`. The port is not complete until they
  exist — the mask and diff formatting logic is exactly the kind that regresses
  silently.
- Remove `firestore-snapshot-utils` from the admin manifest's
  `peerDependencies`, `peerDependenciesMeta`, and `devDependencies`, and drop its
  README section.

Retiring or deprecating the standalone package on npm is **not** part of this
work — it is a published-registry action, separate and outward-facing.

### Rename `firebase-kit-client/testing` → `firebase-kit-client/mocks`

The two packages currently disagree on subpath naming for the same kind of thing.
`firebase-kit-admin` splits `./mocks` (module shims for `vi.mock`) from
`./testing` (helpers: request builders, `expectSuccessResult`, DB snapshot/diff,
emulator hooks). `firebase-kit-client/testing` holds only `create*Mock` factories
— and once `createGetSetDelMock` is removed by the adoption above, it is
*entirely* mocks with zero helpers.

Rename the client subpath to `./mocks` so identical things live under identical
names across both packages. No compatibility alias is kept; the release is
already breaking, and the entry point is being edited anyway.

### Documentation

Both READMEs state peer ranges in prose and in an install snippet, and go stale
the moment the ranges move:

- `packages/firebase-kit-admin/README.md:68` (`firebase-admin` `^13.10.0`),
  `:70` (`firebase-functions` `^7.2.5`), and `:80`
  (`firestore-snapshot-utils` `^3.0.1` — this section is **deleted**, not
  updated, since the dependency is gone)
- `packages/firebase-kit-client/README.md:57` (install snippet,
  `getsetdel@^2.0.0`), `:62` (`firebase` `^12.16.0`), `:64` (`getsetdel`
  `^2.0.0`), plus the `./testing` → `./mocks` rename everywhere the client README
  names that subpath

### Release consequence

This is a breaking release on four counts: replaced peer ranges,
`createGetSetDelMock` removed from `firebase-kit-client/testing`, the client
`./testing` → `./mocks` subpath rename, and `firestore-snapshot-utils` no longer
being a peer consumers install. The publish workflow computes the version with
`conventional-changelog` from commit footers, so **the squashed merge commit must
carry a breaking-change footer** (`!` or a `BREAKING CHANGE:` body) or the
release will publish a minor. `yarn workspaces foreach --all version` versions
all three packages together, so `firebase-kit-protocol` goes to the same major
even though none of its own declarations change — that is existing, intended
behavior.

## Verification (decision 3a)

The dependency upgrades have no natural regression test — there is no defect to
assert against, and a test pinning a version number would only restate the
manifest. The **ported `firestore-snapshot-utils` code is different**: it is new
source in this repo and gets colocated tests per the Test conventions, as stated
in the merge section above.

Verification is therefore the full quality suite plus a real consumer install:

1. `yarn lint` (builds first), `yarn build`, `yarn test:unit`, `yarn
   test:emulator` — the emulator suite is required, since `firebase-admin` 14 is
   the upgrade most likely to shift runtime behavior and
   `firebase-kit-admin` is the package with `*.emulator.test.ts` coverage.
2. **Matched test exception** — the config's *consumer-facing wiring* entry
   applies: the peer ranges and the README install snippets are exactly the
   wiring the repo's own tests cannot exercise, because they import source
   directly. Verify by `yarn pack` (never `npm pack` — only Yarn's packer
   rewrites the `workspace:` protocol) into a throwaway consumer project outside
   the repo, installing the new peer set, and running the documented README
   snippets verbatim, extracting each block to the path in its header comment.

The only new test files are the ones covering the ported
`firestore-snapshot-utils` code. Any code change the `firebase-admin` 14 upgrade
forces is covered by the existing colocated `src/<name>.test.ts` and
`src/<name>.emulator.test.ts` suites, extended in place if a behavior gap shows
up.

### Adopt `getsetdel/testing` (in scope, by explicit user direction)

`getsetdel` 3 ships the test infrastructure this repo currently hand-writes, and
this work adopts it rather than carrying a local duplicate:

- **`getsetdel/testing`** exports its own `createGetSetDelMock`, a **behavioral
  superset** of the repo's local factory at
  `packages/firebase-kit-client/src/testing/createGetSetDelMock.ts`: same
  `failEntriesWith` / `clearEntriesFault` / `stubStore` / `resetGetSetDelMock`
  controls, plus a new `simulateStoreReset`, and it keeps `queryInventory`
  (which the local copy drops with a comment explaining that getsetdel v2 did
  not export the type its signature needs — v3 exports it, so the workaround is
  obsolete). The local factory and its test are deleted.

  Three behavior deltas, all harmless for this repo's current call sites but
  worth stating: upstream `stubStore` stubs all 13 store-touching members where
  the local one stubs only four; upstream `failEntriesWith` rejects with the raw
  armed value where the local one wraps non-`Error` values; and
  `simulateStoreReset` is async and must be awaited.
- **`getsetdel/testing/idb-keyval`** is an in-memory `idb-keyval` backend that
  replaces `fake-indexeddb`, which is dropped as a dev dependency.
  `packages/firebase-kit-client/src/__test__/setup/vi.setup.ts` swaps
  `import 'fake-indexeddb/auto'` for a `vi.mock('idb-keyval', ...)` plus a
  `beforeEach(testClearMockIndexedDB)`, and
  `packages/firebase-kit-client/vitest.config.ts` gains
  `server.deps.inline: ['getsetdel']` — required, because Vitest externalizes
  `node_modules` packages and getsetdel's own `idb-keyval` import would
  otherwise bypass the mock.

The repo's `__mocks__` shim is already at the vitest project root
(`vitest.config.ts` sets `root` to `src`, and the shim is at
`src/__mocks__/getsetdel/`), which is where getsetdel's documented setup requires
it — so no file moves.

**This removes `createGetSetDelMock` from the published
`firebase-kit-client/testing` entry point** — a breaking API change on top of the
peer-range replacement. Consumers import it from `getsetdel/testing` instead.
Only the **client** README documents this factory; the admin README never
mentions getsetdel, so it is untouched by this part.

## Out of scope

- Widening `typescript` past `6.*` or `@types/node` past `24.*`.
- Retiring or deprecating the standalone `firestore-snapshot-utils` package on
  npm — a published-registry action, separate from this repo.
- Any feature, behavior, or API change not forced by an upgraded dependency, the
  `getsetdel/testing` adoption, the `firestore-snapshot-utils` merge, or the
  client `./testing` → `./mocks` rename.
