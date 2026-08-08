# Task 2.3: Move `firebase-kit-admin` and wire the emulator suite

## Goal

Copy `firebase-kit-admin` into the monorepo, get its 48 unit test files (180
`it()`) and 7 emulator test files (21 `it()`) running under the root commands and
in CI, and bring it to a clean lint under the stricter configuration.

## Requirements addressed

REQ-REPO-1, REQ-REPO-4, REQ-QUAL-3a, REQ-QUAL-3b, REQ-TEST-1, REQ-TEST-2,
REQ-TEST-3, REQ-TEST-4, REQ-TEST-5, REQ-TEST-6

## Background

**Work on the mise feature branch.** Task 2.1 landed `firebase-kit-protocol` and
built root test orchestration that invokes the runner **once per package**. Task
2.2 landed `firebase-kit-client` (29 unit files, no emulator tests) and settled
how test projects are selected across packages with differently-shaped configs.

The source is `/Users/eric/Code/okven/packages/firebase-kit-admin`. **Copy it;
never modify the Okven original.** Okven's own emulator test runner
(`scripts/test-emulator-run.ts`) currently finds this package by scanning for a
`ci:test-emulator` script and is the only consumer of it — another reason Okven
must be left exactly as it is.

Shape: ~6.7k LOC across 147 files. `src/` has four loose files (`index.ts`,
`types.ts`, `createInit.ts`, `createInit.test.ts`) plus `__mocks__/`, `__test__/`,
`auth/`, `callable/`, `errors/`, `firestore/` (28 files, 20 in
`firestore/internal/`), `internal/`, `mocks/`, `runtime/`, `tasks/`, `testing/`
(29 files, 13 under `testing/emulator/`), `validation/`.

Non-`src` files at the package root that **must move with it**: `firebase.json`
and `firestore.rules`. Nothing outside this package references them.

It publishes 10 entry points: `.`, `./auth`, `./callable`, `./errors`,
`./firestore`, `./mocks`, `./runtime`, `./tasks`, `./testing`, `./validation`.
`src/internal/` is deliberately not exported by any of them.

**`./mocks` is a real published entry point**, not test scaffolding, despite the
name — its barrel re-exports 7 mock factories plus a types module, for consumers
to use in their own tests. Only
`__mocks__/` (module shims) and `__test__/` (fixtures) are excluded from the
package.

### The emulator setup, which is the delicate part

`vitest.config.ts` declares **two named projects**, `unit` and `emulator`, split
purely by filename: `**/*.emulator.test.ts` belongs to `emulator`, every other
`**/*.test.ts` to `unit`. Both anchor `root` at the package's `src` directory —
same deliberate reason as the client package, so `src/__mocks__/<module>/`
directories are found as automatic shims. `mockReset: true` is repeated in each
project because projects do not inherit the root test block; the source carries a
comment saying exactly that. Only `emulator` has `setupFiles`.

The emulator test command in Okven is a `firebase emulators:exec` invocation
carrying, all of which are load-bearing:
- `--project demo-admin-tests` — the `demo-` prefix is what keeps the emulator
  from contacting real Firebase services
- `--only auth,firestore` — starts just those two emulators
- `TZ=Etc/Universal` wrapping the runner
- a `tsc --build &&` prefix
- **no `--config` flag**, so it depends entirely on running with the admin
  package as the working directory

`firebase.json` sets four ports — auth `9298`, firestore `8281`, hub `4481`,
logging `4581` — on host `127.0.0.1`, with `singleProjectMode: false` and the
emulator UI disabled.

`src/__test__/setup/vi.setup.ts` (the `emulator` project's setup file)
**duplicates** the project id and both host/port pairs:
`projectIdBase: 'demo-admin-tests'`, `firestoreHost: '127.0.0.1:8281'`,
`authHost: '127.0.0.1:9298'`, plus `isolationSeed: import.meta.url`. These must
stay in agreement with `firebase.json` and the test script.

The 7 emulator test files live in exactly two directories: `src/firestore/`
(3 files) and `src/firestore/internal/` (4 files).

## Files to modify/create

- `packages/firebase-kit-admin/src/` — copied from Okven (147 files)
- `packages/firebase-kit-admin/firebase.json`, `firestore.rules` — copied
- `packages/firebase-kit-admin/vitest.config.ts` — copied
- `packages/firebase-kit-admin/tsconfig.json` — copied, `removeComments: false`
- `packages/firebase-kit-admin/package.json` — real manifest replacing the
  placeholder
- `tsconfig.json` — add the project reference
- `package.json` — add to both unit and emulator orchestration
- Source files under `src/` — only as the stricter lint requires

## Implementation details

1. **Copy `src/`, `firebase.json`, and `firestore.rules` verbatim.** All 147
   source files including `__mocks__/` and `__test__/`.

2. **Copy `tsconfig.json`**, setting `removeComments` to `false` and keeping the
   project reference to `../firebase-kit-protocol`.

3. **Copy `vitest.config.ts` preserving all of it**: both named projects, the
   filename-based split, `root` anchored at `src` in both, and `mockReset: true`
   repeated in each. Keep the comments explaining the split and the
   non-inheritance — both encode reasons that are not obvious from the code.

   The two named projects must survive, because the unit and emulator groups have
   to be runnable independently. Whatever selection scheme task 2.2 settled on
   must accommodate that.

4. **Write the real `package.json`,** replacing the placeholder. Carry over
   `type: module`, all 10 `exports` entries, `files`, `sideEffects: false`,
   `engines.node >= 24`, public access.

   Declare `firebase-kit-protocol` with the **exact** workspace protocol
   (`workspace:*`), not Okven's caret form.

   Give it `build`, `lint`, a unit test script, and an emulator test script. The
   emulator script must preserve **every** element listed in the Background —
   project id, the auth/firestore restriction, the timezone, the build prefix,
   and the working-directory dependency. If the root command invokes it from the
   repository root rather than the package directory, the missing `--config` will
   make the emulator start with the wrong (or no) configuration; either invoke it
   with the package as cwd or add an explicit config path.

   **Set the version to `0.0.1`**, matching the root and the published
   placeholder. Okven's manifest reads `0.0.0`; copying that verbatim breaks the
   lockstep invariant and would not surface until task 3.4.

   **Carry the dependency declarations over too** — runtime, peer, optional-peer,
   and development — so the package installs, builds, and tests within this task.
   Task 2.4 *audits* and corrects them, including the optional-peer change and
   the `firebase-tools` pin; it does not create them from nothing.

5. **Add the project reference** to the root `tsconfig.json`.

6. **Add the package to both root test commands** — unit and emulator — keeping
   the one-invocation-per-package structure.

7. **Wire the emulator toolchain in CI.** Task 1.2 added the composite action
   that installs Java 21 and caches the emulator binaries, and referenced it from
   both `publish.yml` and the dependabot workflow. Confirm it actually works now
   that there are emulator tests to run: this is the first time that path
   executes.

8. **Measure the lint fallout before fixing it,** as in task 2.2: record the total
   and the per-rule breakdown for this package and report it.

9. **Fix every finding by changing the code.** No rule disabling, no downgrading
   to warnings, no `eslint-disable` comments, and no **newly introduced** type
   assertions to silence findings. Pre-existing assertions stay. Raise anything
   that appears to genuinely need a suppression rather than suppressing it.

10. **Do not change test behavior.** No test deleted, skipped, or weakened.

11. **Leave `src/__test__/utils/setFakeTimer.ts` alone.** It hard-codes
    `TestTimeZone = 'America/Puerto_Rico'` with a comment noting the package
    cannot reach the product's shared timezone constant — a fossil of the project
    this code is leaving. It is nonetheless just a fixed timezone that the tests
    assert against, and changing it is behavior change this work excludes. Note it
    and move on.

## Testing suggestions

The package's own suites are the verification. Per the project's test exception
for library packages with no e2e infrastructure, there is no browser-level
testing; the emulator suite is the integration-level coverage.

- `yarn test:unit` must report **48 test files and 180 passing `it()` cases** for
  this package. Reconcile explicitly.
- `yarn test:emulator` must report **7 test files and 21 passing `it()` cases**,
  running against the local emulator with no real Firebase project and no
  credentials.
- Confirm the two groups are independently runnable: the unit command must not
  start an emulator, and the emulator command must not run unit files.
- Confirm the `__mocks__` shims are active, as in task 2.2 — the unit tests mock
  `firebase-admin/app`, and the emulator setup file has a comment warning that
  initializing an app underneath the unit project would break it.
- Confirm the emulator job passes in CI, not just locally — that exercises the
  Java install and the binary cache for the first time.

## Gotchas

- **`./mocks` is public API.** Any `files`/exclusion pattern that filters
  directories by the word "mock" will delete a documented entry point from the
  published package. Only `__mocks__` and `__test__` are excluded.
- **The emulator command has no `--config` flag** and silently depends on cwd.
  This is the single most likely thing to break when moving from a
  package-local script to a root-level command.
- **Three files hold the same ports and project id.** `firebase.json`, the test
  script, and `src/__test__/setup/vi.setup.ts`. Change one and the failure looks
  like a connection problem, not a config drift.
- **Moving `root` off `src` breaks the automocks silently** — same hazard as
  task 2.2, with more surface here.
- **The emulator suite is now a release gate.** Every push to `main` runs it, so
  a flake here blocks publishing. Prefer diagnosing flakiness over retrying.
- **`isolationSeed: import.meta.url` derives the project id suffix from the
  file's absolute path**, so project ids differ between this checkout and Okven's.
  Harmless, but expect different emulator project names than you may have seen
  before.

## Verification checklist

- [ ] `src/`, `firebase.json`, and `firestore.rules` match the Okven source byte
      for byte, except where the stricter lint required a change
- [ ] The Okven repository is unmodified
- [ ] `vitest.config.ts` keeps both named projects, the filename split, `root` at
      `src` in both, and `mockReset` in each
- [ ] `tsconfig.json` sets `removeComments: false` and references protocol
- [ ] `package.json` declares `firebase-kit-protocol` as `workspace:*`
- [ ] All 10 `exports` entries carried over; `./mocks` is present and not excluded
      from the published files
- [ ] The emulator command preserves the project id, the auth/firestore
      restriction, `TZ=Etc/Universal`, the build prefix, and the correct working
      directory
- [ ] `firebase.json` and `src/__test__/setup/vi.setup.ts` agree on both
      host/port pairs and the project id
- [ ] `yarn test:unit` reports 48 files / 180 passing cases for this package
- [ ] `yarn test:emulator` reports 7 files / 21 passing cases
- [ ] The two groups run independently of each other
- [ ] Emulator tests need no real Firebase project or credentials
- [ ] The CI emulator job passes, exercising the Java install and binary cache
- [ ] No test was deleted, skipped, or weakened
- [ ] The lint fallout count and rule breakdown were recorded and reported
- [ ] No `eslint-disable` comment anywhere; no newly introduced type assertion
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test` all pass
- [ ] End-to-end tests: none — the project's test exception for library packages
      with no e2e infrastructure applies; substitute verification is the emulator
      suite (7 files / 21 cases) passing locally and in CI, plus the unit-count
      reconciliation above
