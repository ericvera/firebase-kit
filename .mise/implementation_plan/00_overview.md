# Implementation Plan

## Summary

Move every dependency in the `firebase-kit` monorepo to its latest published
version, except `typescript` (held at `6.*`) and `@types/node` (held at `24.*`),
which are already at the top of their allowed major and do not change. Three
dependencies have new majors — `firebase-admin` 14, `firestore-snapshot-utils` 4,
`getsetdel` 3 — and all three are `peerDependencies` of published packages, so
their ranges are **replaced** rather than widened, making this a breaking release
for v1.0.0 consumers.

## Design

This is a dependency refresh, not a feature. The design question is only how to
sequence it so each task ends green and a failure is attributable.

```
Phase 1 — the upgrade itself
  01_01  in-range bumps        low risk; isolates "did the tooling break?"
           eslint, typescript-eslint, firebase, firebase-functions, scdate-testing
           + the two README lines those ranges are quoted on
              |
              v
  01_02  the three majors      all the upgrade risk lives here
           firebase-admin 13 -> 14, firestore-snapshot-utils 3 -> 4, getsetdel 2 -> 3
           + forced code changes + the README lines and the stale getsetdel pin note
           test infrastructure deliberately untouched
              |
              v
  01_03  adopt getsetdel/testing
           delete the local createGetSetDelMock + its test, drop fake-indexeddb,
           rewire the vitest setup/config, rewrite the client README testing docs
           -> removes createGetSetDelMock from the published ./testing entry point
              |
              v
Phase 2 — verification the repo's own tests structurally cannot do
  02_01  pack into a throwaway consumer, install the new peer set,
         run the README snippets verbatim
```

Two splits carry the design.

Splitting 01_01 from 01_02 means that if the build, lint, or test suite breaks in
01_02, the cause is a major upgrade and not an `eslint` patch or a
`typescript-eslint` minor. One extra commit buys a clean bisect on the risky step.

Splitting 01_03 from 01_02 separates *raising the range* from *adopting what the
new major ships*. 01_02 keeps the existing hand-written mock and `fake-indexeddb`
and must end green on them, so if the test-infrastructure swap in 01_03 goes
wrong it is revertable on its own without giving back the `getsetdel` 3 upgrade.

Phase 2 is separate because it is the only verification that runs against a
**packed tarball installed as a real consumer**, and it must run after every
range and entry-point change is final. Folding it into an earlier task would mean
re-running it on every intermediate state.

### What changes, exactly

Version data was read from the npm registry on 2026-08-13.

**No change** (already latest, or held by the goals' constraints):
`@eslint/js` (10.0.1), `@tsconfig/strictest` (2.0.8), `@types/node` (24.13.3,
held at `24.*`), `betterbe` (4.1.0), `fake-indexeddb` (6.2.5), `firebase-tools`
(exact pin 15.26.0), `husky` (9.1.7), `lint-staged` (17.3.0), `prettier`
(3.9.6), `typescript` (6.0.3, held at `6.*`), `vitest` (4.1.10).

**Task 01_01 — in-range** (the current range already resolves these; the floor
moves per the goals' decision to bump every declared range):

| Package              | From       | To         | Where                                             |
| -------------------- | ---------- | ---------- | ------------------------------------------------- |
| `eslint`             | `^10.8.0`  | `^10.8.1`  | root dev + all 3 packages dev                     |
| `typescript-eslint`  | `^8.66.0`  | `^8.67.0`  | root dev                                          |
| `firebase`           | `^12.16.0` | `^12.17.1` | client **peer + dev**                             |
| `firebase-functions` | `^7.2.5`   | `^7.3.2`   | admin **peer + dev**                              |
| `scdate-testing`     | `^7.0.0`   | `^7.1.2`   | admin dev                                         |

**Task 01_02 — majors** (peer ranges replaced):

| Package                    | From       | To        | Where                          |
| -------------------------- | ---------- | --------- | ------------------------------ |
| `firebase-admin`           | `^13.10.0` | `^14.2.0` | admin **peer + dev**           |
| `firestore-snapshot-utils` | `^3.0.1`   | `^4.0.0`  | admin **peer (optional) + dev**|
| `getsetdel`                | `^2.0.0`   | `^3.0.0`  | client **peer + dev**          |

## Assumptions

Recorded because `goals.md` is silent on each; none were confirmed with the user.

1. **The plan deviates from the bugfix template's single-fix-task shape.** The
   template prescribes one `01_01_fix.md` when a Test exception matches. This
   plan uses four tasks because the work spans three major upgrades, a
   test-infrastructure replacement, and a packed-consumer verification, which
   exceeds the "no task larger than ~2 hours" rule and would lose the bisect
   boundary between low-risk and high-risk changes. The template's actual
   structural point — **no regression-test task, because a Test exception
   matched** — is preserved: no task writes a new test file.
2. **Yarn is the only package manager used.** The repo pins `yarn@4.18.0` via
   `packageManager` and ships `.yarnrc.yml`. Every install/upgrade step uses
   `yarn`, and packing uses `yarn pack` — `npm pack` is explicitly forbidden by
   the config's Test exceptions because only Yarn rewrites `workspace:`.
3. **Ranges are edited in `package.json` and applied with `yarn install`,** not
   driven through `yarn up`. `yarn up` rewrites ranges with its own style and
   does not touch `peerDependencies`, which is where most of this work lives.
4. **`firebase-tools` stays at its exact pin `15.26.0`.** It is declared without
   a caret in both the root and admin manifests, which reads as deliberate (the
   emulator binary version is a test-environment control). It is already latest,
   so no decision is forced; if it were behind, the pin would be honored.
5. **No new test file is added.** Per `goals.md` the consumer-facing-wiring Test
   exception governs. If a major upgrade forces a code change, its coverage comes
   from extending the existing colocated `src/<name>.test.ts` /
   `src/<name>.emulator.test.ts` suite in place.
6. **The `getsetdel` "must be major 2" README paragraph is deleted, not
   rewritten.** It exists solely to explain the v2 pin and explicitly says the
   range "will move when it is ported." Task 01_02 does the port, so the
   paragraph's reason to exist is gone.
7. **The local `createGetSetDelMock` is deleted rather than kept as a deprecated
   re-export of getsetdel's.** The release is already breaking, so a compatibility
   shim would add a permanently-maintained alias to avoid a one-line consumer
   change that the README documents. Its test
   (`src/testing/createGetSetDelMock.test.ts`) goes with it rather than being
   re-pointed at the upstream factory — testing a dependency's implementation is
   not this repo's job.

## Phases

- **Phase 1: Upgrade** — move every range to its new floor and adopt the test
  infrastructure `getsetdel` 3 ships, in three commits split by risk, with the
  READMEs kept consistent within each commit.
- **Phase 2: Consumer verification** — prove the published wiring works by
  installing packed tarballs into a throwaway project outside the repo.

## Phase Rationale

Phase 1 before Phase 2 is forced: the consumer verification installs the final
peer set, so it cannot run until both range changes have landed. Within Phase 1,
01_01 before 01_02 makes any Phase-1 breakage attributable — after 01_01 the
toolchain is current and green, so anything that breaks in 01_02 is one of the
three majors.

## Task Index

| File                                | Task                                                             | Phase | Goals section                          |
| ----------------------------------- | ---------------------------------------------------------------- | ----- | -------------------------------------- |
| `01_01_in_range_upgrades.md`        | Bump the five in-range dependencies and the READMEs they touch    | 1     | "In-range upgrades (decision 2b)"      |
| `01_02_major_upgrades.md`           | Upgrade the three majors, fix fallout, update the READMEs         | 1     | "Major upgrades (decision 1b)"         |
| `01_03_adopt_getsetdel_testing.md`  | Replace the local mock and `fake-indexeddb` with `getsetdel/testing` | 1  | "Adopt `getsetdel/testing`"            |
| `02_01_consumer_verification.md`    | Pack into a throwaway consumer and run the README snippets        | 2     | "Verification (decision 3a)", item 2   |
