# Task 2.2: Move `firebase-kit-client`

## Goal

Copy `firebase-kit-client` into the monorepo, wire its dependency on
`firebase-kit-protocol`, get its 29 test files (149 `it()` cases) running under
the root commands, and bring it to a clean lint under the stricter configuration.

## Requirements addressed

REQ-REPO-1, REQ-REPO-4, REQ-QUAL-3a, REQ-QUAL-3e, REQ-QUAL-4, REQ-QUAL-4a,
REQ-TEST-1, REQ-TEST-2, REQ-TEST-6, REQ-PKG-6

## Background

**Work on the mise feature branch.** Task 2.1 landed
`firebase-kit-protocol` (source, tsconfig with `removeComments: false`, a project
reference in the root `tsconfig.json`, and `build`/`lint` scripts but no `test`
script), and replaced the phase-1 stub test scripts with real orchestration that
invokes the test runner **once per package**.

The source is `/Users/eric/Code/okven/packages/firebase-kit-client`. **Copy it;
never modify the Okven original.**

Shape of the package: ~5.9k LOC across 80 files. `src/` has four loose files
(`index.ts`, `types.ts`, `getErrorWithCode.ts`, `getErrorWithCode.test.ts`) and
these directories: `__mocks__/`, `__test__/`, `callable/`, `connectivity/`,
`firestore/` (41 files, of which `firestore/internal/` holds 32), `rate-limit/`,
`runtime/`, `testing/`.

It publishes 7 entry points: `.`, `./callable`, `./connectivity`, `./firestore`,
`./rate-limit`, `./runtime`, `./testing`.

Two things about its test setup are load-bearing:

- **`vitest.config.ts` anchors `root` at the package's `src` directory, not the
  package directory.** This is deliberate and commented in the source: it places
  `src/__mocks__/<module>/` inside the runner's root so those directories are
  discovered as automatic module shims, while staying inside the tsconfig's
  `rootDir`. Anchor at the package directory instead and the tests keep running
  but silently resolve the real `firebase/app` and `getsetdel` modules rather
  than the shims — green, and testing nothing.
- **It declares a single, unnamed test project**, where `firebase-kit-admin`
  (task 2.3) declares two named ones. Reconciling those two shapes is part of
  this task.

`src/__mocks__/` contains `firebase/app/` (shims `getApp`, `getApps`,
`initializeApp`, plus a reset helper, built from the package's own
`testing/createFirebaseAppMock`) and `getsetdel/` (shims the full `getsetdel`
surface with fault switches, layered over the real module).

`src/__test__/` has two files: `setup/vi.setup.ts`, which imports
`fake-indexeddb/auto` so the Firestore cache layer has an IndexedDB to store
through, and `utils/createTestFirestoreDependencies.ts`, a dependency-bag builder
for the Firestore-layer tests.

The lint configuration in this repository is materially stricter than the one
these files were written under. Okven lints them with a Nuxt-based config;
this repository uses `strictTypeChecked` plus `stylisticTypeChecked` plus local
rules. **A meaningful number of new findings is expected and this is the first
package where that lands at scale.**

## Files to modify/create

- `packages/firebase-kit-client/src/` — copied from Okven (80 files)
- `packages/firebase-kit-client/vitest.config.ts` — copied, possibly renamed
  project
- `packages/firebase-kit-client/tsconfig.json` — copied, `removeComments: false`
- `packages/firebase-kit-client/package.json` — real manifest replacing the
  placeholder
- `tsconfig.json` — add the project reference
- `package.json` — include the package in the unit-test orchestration
- Source files under `src/` — only as the stricter lint requires

## Implementation details

1. **Copy `src/` verbatim**, all 80 files including `__mocks__/` and `__test__/`.
   Do not reorganize, rename, or "tidy" anything.

2. **Copy `tsconfig.json`**, changing `removeComments` to `false` for the same
   consumer-intellisense reason as task 2.1, and keeping its project reference to
   `../firebase-kit-protocol`.

3. **Copy `vitest.config.ts`, preserving `root` at `src`** and its explanatory
   comment, `mockReset: true`, the node_modules/dist excludes, and
   `setupFiles: ['./__test__/setup/vi.setup.ts']`.

4. **Reconcile the project shape with `firebase-kit-admin`.** Task 2.3 brings in
   a package declaring two *named* projects, `unit` and `emulator`. This package
   declares one unnamed project.

   If the root orchestration selects by exact project name, this package matches
   nothing and its entire suite is skipped silently.

   Because task 2.1 established **one runner invocation per package**, each
   package's config is loaded in its own run, and project-name uniqueness is
   scoped to a single config. This package may therefore give its project the
   same name `firebase-kit-admin` uses for its unit group — there is no collision
   — which makes a uniform name-based selection across both packages the simplest
   correct design.

   `firebase-kit-admin` must keep a name-based split regardless, because its unit
   and emulator groups have to be runnable independently.

5. **Write the real `package.json`,** replacing the placeholder. Carry over from
   Okven: `type: module`, all 7 `exports` entries, `files`, `sideEffects: false`,
   `engines.node >= 24`, public access. Add `build`, `lint`, and a `test` script.

   Declare the dependency on `firebase-kit-protocol` using the **exact** workspace
   protocol (`workspace:*`), **not** the caret form (`workspace:^`) Okven uses.
   The exact form rewrites to a pinned equality range at publish time, which is
   what the lockstep versioning scheme wants.

   **Set the version to `0.0.1`**, matching the root and the published
   placeholder. Okven's manifest reads `0.0.0`; copying that verbatim breaks the
   lockstep invariant and would not be caught until task 3.4.

   **Carry the dependency declarations over too** — the runtime, peer,
   optional-peer, and development dependencies Okven's manifest declares, so the
   package installs, builds, and tests within this task. Task 2.4 *audits* those
   declarations against actual imports and corrects them; it does not create them
   from nothing. Leave the `getsetdel` peer range exactly as it is — it stays at
   its current major deliberately.

6. **Add the project reference** for this package to the root `tsconfig.json`.

7. **Add the package to the unit-test orchestration.** It has no emulator tests,
   so it must not appear in the emulator command — and it must be excluded by not
   being in that command's package list, not by a tolerance flag.

8. **Measure the lint fallout before fixing it.** Run the repository lint and
   record the total finding count and the breakdown by rule. Report those numbers
   — the goals document flags this fallout as an unmeasured risk, and this is the
   first point at which it can actually be measured.

9. **Fix every finding by changing the code.** Turning a rule off, downgrading it
   to a warning, and adding `eslint-disable` comments are all forbidden. Introducing
   a **new** type assertion (`as`, `as unknown as`, non-null) to silence a finding
   counts as suppression and is equally forbidden.

   The sources already contain roughly 200 `as` assertions; those are pre-existing
   and stay — do not remove or rewrite them, that is out of scope.

   If a finding genuinely appears to require a suppression, stop and raise it
   rather than suppressing it silently.

10. **Do not change test behavior.** No test may be deleted, skipped, or weakened
    to accommodate the move or the stricter lint. The tests already use the flat
    `it()` style with no `describe` wrappers, which the lint configuration
    enforces — that should need no work.

## Testing suggestions

The package's own suite is the verification. Per the project's test exception for
library packages with no e2e infrastructure, there is no browser-level testing.

- `yarn test:unit` must run this package and report **29 test files and 149
  passing `it()` cases**. Reconcile against those numbers explicitly; a lower
  count means files are not being picked up.
- Confirm the module shims are active: a test that relies on
  `src/__mocks__/getsetdel/` or `src/__mocks__/firebase/app/` should fail in a
  recognizably "mock missing" way if `root` is temporarily pointed at the package
  directory. Verify the shims work, then restore.
- `yarn test:emulator` must not attempt to run anything for this package.
- `yarn build` and `yarn lint` clean across the repository.

## Gotchas

- **Moving `root` off `src` breaks the automocks silently.** Tests still pass —
  against the real modules. This is the highest-value thing to verify in the task
  and the least visible if you skip it.
- **Selecting test projects by exact name skips this package entirely** and
  reports success. Cross-check the file and case counts rather than trusting a
  green run.
- **`workspace:^` is what the source says; `workspace:*` is what this repo needs.**
  Copying the manifest wholesale carries the wrong form.
- **Lint fixes are where behavior can drift.** `strictTypeChecked` findings often
  tempt a change in narrowing or nullability handling. The requirement is a code
  change that preserves behavior, not the shortest path to a clean run.
- **`fake-indexeddb/auto` must load before any test touches the cache layer.**
  It is wired through `setupFiles`; if that path is lost in the copy, cache tests
  fail in confusing ways that look like cache bugs.

## Verification checklist

- [ ] `packages/firebase-kit-client/src/` matches the Okven source byte for byte,
      except where the stricter lint required a change
- [ ] The Okven repository is unmodified
- [ ] `vitest.config.ts` still anchors `root` at `src`, with its comment intact
- [ ] The `__mocks__` shims are verified active, not merely present
- [ ] `tsconfig.json` sets `removeComments: false` and references protocol
- [ ] `package.json` declares `firebase-kit-protocol` as `workspace:*`
- [ ] All 7 `exports` entries carried over unchanged
- [ ] `package.json` declares `type: module`, `engines.node >= 24`, and
      `sideEffects: false`
- [ ] `yarn test:unit` reports 29 files / 149 passing cases for this package
- [ ] `yarn test:emulator` runs nothing for this package
- [ ] No test was deleted, skipped, or weakened
- [ ] The lint fallout count and rule breakdown were recorded and reported
- [ ] No `eslint-disable` comment anywhere; no newly introduced type assertion
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test` all pass
- [ ] End-to-end tests: none — the project's test exception for library packages
      with no e2e infrastructure applies; substitute verification is the
      29-file / 149-case reconciliation and the automock activation check above
