# Implementation Plan

## Summary

Move every dependency in the `firebase-kit` monorepo to its latest published
version, except `typescript` (held at `6.*`) and `@types/node` (held at `24.*`),
which are already at the top of their allowed major and do not change. Along the
way, absorb `firestore-snapshot-utils` into `firebase-kit-admin`, adopt the test
infrastructure `getsetdel` 3 now ships, and rename `firebase-kit-client/testing`
to `./mocks` so both packages name the same kind of thing the same way.

This is a breaking release on four counts: replaced peer ranges,
`createGetSetDelMock` removed from the client's testing entry point, the client
subpath rename, and `firestore-snapshot-utils` no longer being a peer.

## Design

### The ordering constraint that shapes everything

`firestore-snapshot-utils` declares `peerDependencies: { "firebase-admin":
"^13.5.0" }` — **required**, in both 3.0.1 and 4.0.0. No published version of it
accepts `firebase-admin` 14. Yarn only warns (`YN0060`), but a consumer on npm
hard-fails with `ERESOLVE`.

So the merge must land **before** the `firebase-admin` upgrade. Sequenced that
way, no task ever holds the conflicting pair, and no upstream release is needed.
Reverse the order and task 01_03 leaves the repo in a state a consumer cannot
install.

```
Phase 1
  01_01  in-range bumps          low risk; isolates "did the tooling break?"
           eslint, typescript-eslint, firebase, firebase-functions, scdate-testing
              |
              v
  01_02  merge firestore-snapshot-utils      <-- must precede 01_03
           port 709 LOC + write its tests, jest-diff becomes a dependency,
           drop the peer/dev/peerMeta entries and the README section
              |
              v
  01_03  firebase-admin 13 -> 14             <-- now unblocked
           the peer cap is gone with the dependency
              |
              v
  01_04  getsetdel 2 -> 3                    range only, infrastructure untouched
              |
              v
  01_05  adopt getsetdel/testing + rename ./testing -> ./mocks
           both rewrite the same client entry point and README sections
              |
              v
Phase 2
  02_01  pack into a throwaway consumer, install the new peer set,
         run the README snippets verbatim
```

### Why these task boundaries

- **01_01 before everything** — after it the toolchain is current and green, so
  any later breakage is attributable to a dependency change rather than an
  `eslint` patch.
- **01_02 before 01_03** — forced by the peer conflict above.
- **01_04 separate from 01_05** — raising the `getsetdel` range is not the same
  as adopting what the new major ships. 01_04 keeps the existing hand-written
  mock and `fake-indexeddb` and must end green on them, so if the
  infrastructure swap goes wrong it reverts without giving back the upgrade.
- **01_05 combines the adoption and the rename** — both rewrite
  `packages/firebase-kit-client/src/testing/`, the package's `exports` map, and
  the same client-README sections. Splitting them means editing the same prose
  twice and briefly shipping a `./testing` entry point that is renamed but still
  documented under the old name.
- **Phase 2 last** — it is the only verification that runs against packed
  tarballs installed as a real consumer, and every range and entry-point change
  must be final first.

### What changes, exactly

Registry data read 2026-08-13.

**No change** (already latest, or held by the goals' constraints):
`@eslint/js` (10.0.1), `@tsconfig/strictest` (2.0.8), `@types/node` (24.13.3,
held at `24.*`), `betterbe` (4.1.0), `firebase-tools` (exact pin 15.26.0),
`husky` (9.1.7), `lint-staged` (17.3.0), `prettier` (3.9.6), `typescript`
(6.0.3, held at `6.*`), `vitest` (4.1.10).

**Removed:** `firestore-snapshot-utils` (merged in by 01_02), `fake-indexeddb`
(replaced by `getsetdel/testing/idb-keyval` in 01_05).

**Added:** `jest-diff` `^30.4.1` as a regular `dependency` of
`firebase-kit-admin` (01_02).

**Task 01_01 — in-range** (the current range already resolves these; the floor
moves per the goals' decision to bump every declared range):

| Package              | From       | To         | Where                          |
| -------------------- | ---------- | ---------- | ------------------------------ |
| `eslint`             | `^10.8.0`  | `^10.8.1`  | root dev + all 3 packages dev  |
| `typescript-eslint`  | `^8.66.0`  | `^8.67.0`  | root dev                       |
| `firebase`           | `^12.16.0` | `^12.17.1` | client **peer + dev**          |
| `firebase-functions` | `^7.2.5`   | `^7.3.2`   | admin **peer + dev**           |
| `scdate-testing`     | `^7.0.0`   | `^7.1.2`   | admin dev                      |

**Tasks 01_03 / 01_04 — majors** (peer ranges replaced, never widened):

| Package          | From       | To        | Where                 | Task  |
| ---------------- | ---------- | --------- | --------------------- | ----- |
| `firebase-admin` | `^13.10.0` | `^14.2.0` | admin **peer + dev**  | 01_03 |
| `getsetdel`      | `^2.0.0`   | `^3.0.0`  | client **peer + dev** | 01_04 |

## Assumptions

Recorded because `goals.md` is silent on each; none were confirmed with the user.

1. **The plan deviates from the bugfix template's single-fix-task shape.** The
   template prescribes one `01_01_fix.md` when a Test exception matches. This
   plan uses six tasks because the work spans a library merge, two major
   upgrades, a test-infrastructure replacement, an entry-point rename, and a
   packed-consumer verification — far past the "no task larger than ~2 hours"
   rule. The template's structural point is preserved where it applies: no task
   writes a regression test for a defect, because there is no defect. The ported
   library code does get tests, because it is new source in this repo, not a
   dependency upgrade.
2. **Yarn is the only package manager used.** The repo pins `yarn@4.18.0` and
   ships `.yarnrc.yml`. Packing uses `yarn pack` — `npm pack` is explicitly
   forbidden by the config's Test exceptions because only Yarn rewrites
   `workspace:`.
3. **Ranges are edited in `package.json` and applied with `yarn install`,** not
   driven through `yarn up`, which rewrites ranges in its own style and does not
   touch `peerDependencies`.
4. **`firebase-tools` stays at its exact pin `15.26.0`** in both the root and
   admin manifests. The missing caret reads as deliberate (the emulator binary is
   a test-environment control). It is already latest, so nothing is forced.
5. **The merge preserves `firebase-kit-admin`'s existing public shape rather
   than the library's.** The admin package's wrappers (`getDBSnapshot`,
   `getDBChanges`, `getDBChangesDiff`) keep their current signatures; the
   library's extra `debugOptions` parameter on `getDBSnapshotChanges` is not
   newly exposed. `normalizeData` is added to the entry point because it is a
   public library export the admin emulator tests already use directly.
6. **The `getsetdel` "must be major 2" README paragraph is deleted, not
   rewritten.** It exists solely to explain the v2 pin and says the range "will
   move when it is ported." Task 01_04 does the port.
7. **The local `createGetSetDelMock` is deleted rather than kept as a deprecated
   re-export.** The release is already breaking, so a compatibility shim would
   add a permanently-maintained alias to avoid a one-line consumer change the
   README documents. Its test goes with it rather than being re-pointed at the
   upstream factory — testing a dependency's implementation is not this repo's
   job.
8. **No compatibility alias is kept for the client `./testing` subpath.** Same
   reasoning as 7.

## Release consequence — the commit footer decides the version

Per `goals.md`, this is a breaking release on four counts: replaced peer ranges,
`createGetSetDelMock` removed from the client, the `./testing` → `./mocks`
rename, and `firestore-snapshot-utils` no longer being a peer.

`.github/workflows/publish.yml` computes the version with
`TriPSs/conventional-changelog-action`, **from commit footers only**. The config's
`Ship` value is `merge (squash)`, so a single squashed commit message decides
whether this publishes as a major or a minor. **That message must carry a
breaking-change footer** — a `!` after the type, or a `BREAKING CHANGE:` body.

Without it the workflow publishes a minor, and consumers on the v1 range silently
resolve a package whose peers they cannot satisfy. Nothing in the test suite or
the quality gates catches this; the only guard is writing the footer.

## Phases

- **Phase 1: Upgrade, merge, and rename** — five commits, ordered so each ends
  green and the peer conflict never materializes.
- **Phase 2: Consumer verification** — prove the published wiring works by
  installing packed tarballs into a throwaway project outside the repo.

## Phase Rationale

Phase 1's internal order is set by the peer conflict (01_02 before 01_03) and by
risk isolation (01_01 first; 01_04 before 01_05). Phase 2 must be last because it
installs the final peer set and the final entry-point surface — running it
earlier would only retest an intermediate state.

## Task Index

| File                                     | Task                                                              | Phase | Goals section                        |
| ---------------------------------------- | ----------------------------------------------------------------- | ----- | ------------------------------------ |
| `01_01_in_range_upgrades.md`             | Bump the five in-range dependencies and the READMEs they touch     | 1     | "In-range upgrades (decision 2b)"    |
| `01_02_merge_firestore_snapshot_utils.md`| Port the library in with tests; drop the peer; add `jest-diff`     | 1     | "Merge `firestore-snapshot-utils`"   |
| `01_03_firebase_admin_14.md`             | Upgrade `firebase-admin` to `^14.2.0` and fix any fallout          | 1     | "Major upgrades (decision 1b)"       |
| `01_04_getsetdel_3.md`                   | Move the `getsetdel` range to `^3.0.0`, infrastructure untouched   | 1     | "Major upgrades (decision 1b)"       |
| `01_05_getsetdel_testing_and_mocks.md`   | Adopt `getsetdel/testing`; rename client `./testing` → `./mocks`   | 1     | "Adopt `getsetdel/testing`", "Rename"|
| `02_01_consumer_verification.md`         | Pack into a throwaway consumer and run the README snippets         | 2     | "Verification (decision 3a)", item 2 |
