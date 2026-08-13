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
| `firestore-snapshot-utils` | `^3.0.1`  | `^4.0.0`  | admin: peer (optional) + dev   |
| `getsetdel`                | `^2.0.0`  | `^3.0.0`  | client: peer + dev             |

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
2. **`firestore-snapshot-utils` 4** — masked property values change format
   (`••••` → `/String/`, and non-string values now render as a type token).
   The repo has no committed `.snap` files, and the `toMatchInlineSnapshot`
   assertions in the emulator tests call `normalizeData` without masks, so the
   repo's own tests should be unaffected. The change does alter output for
   consumers of the re-exported `getDBChanges` / `getDBChangesDiff`.
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

### Documentation

Both READMEs state peer ranges in prose and in an install snippet, and go stale
the moment the ranges move:

- `packages/firebase-kit-admin/README.md:68` (`firebase-admin` `^13.10.0`) and
  `:80` (`firestore-snapshot-utils` `^3.0.1`)
- `packages/firebase-kit-client/README.md:57` (install snippet,
  `getsetdel@^2.0.0`), `:62` (`firebase` `^12.16.0`), `:64` (`getsetdel`
  `^2.0.0`)

### Release consequence

Replacing the peer ranges is a breaking change for anyone on v1.0.0. The publish
workflow computes the version with `conventional-changelog` from commit footers,
so **the squashed merge commit must carry a breaking-change footer** (`!` or a
`BREAKING CHANGE:` body) or the release will publish a minor and leave consumers
resolving an incompatible peer set. `yarn workspaces foreach --all version`
versions all three packages together, so `firebase-kit-protocol` goes to the same
major even though none of its own declarations change — that is existing,
intended behavior.

## Verification (decision 3a)

A dependency upgrade has no natural regression test — there is no defect to
assert against, and a test pinning a version number would only restate the
manifest. Verification is therefore the full quality suite plus a real consumer
install:

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

No new test file is added. Any code change the `firebase-admin` 14 upgrade forces
is covered by the existing colocated `src/<name>.test.ts` and
`src/<name>.emulator.test.ts` suites, extended in place if a behavior gap shows
up.

## Out of scope

- Widening `typescript` past `6.*` or `@types/node` past `24.*`.
- Adopting `getsetdel`'s new `getsetdel/testing` subpath (an in-memory
  idb-keyval backend) to replace the repo's hand-written `__mocks__/getsetdel`
  and its `fake-indexeddb` dev dependency. A genuine simplification, but it is a
  refactor, not an upgrade — separate work.
- Any feature, behavior, or API change not forced by an upgraded dependency.
