# 02_05 Sort diff sections by path before kind, document the new paths, and carry the breaking footer

## Goal

Commit the last of the amendment's work: `getDBChangesDiff` sections sort by path first and kind second, so a parent's section sits directly above its children's. Commit the README paragraph and JSDoc that describe numbered parents and the new order. The commit body carries a second `BREAKING CHANGE:` footer saying snapshots must be re-recorded. The code and docs are already in the working tree, uncommitted. This task checks and commits them, it does not rewrite them. After this task nothing under `packages/` is left uncommitted.

## Files to modify/create

1. `packages/firebase-kit-admin/src/testing/internal/compareDocPaths.ts` (new, already in the working tree)
2. `packages/firebase-kit-admin/src/testing/internal/formatDBChanges.ts` (already edited)
3. `packages/firebase-kit-admin/src/testing/getDBChangesDiff.ts` (JSDoc only, already edited)
4. `packages/firebase-kit-admin/README.md` (one new paragraph, already edited)

Tests: `internal/compareDocPaths.test.ts` (new), `internal/formatDBChanges.test.ts`, `getDBChangesDiff.test.ts` (all under `packages/firebase-kit-admin/src/testing/`, already in the working tree).

## Background

- Task 02_03 committed `compareCodeUnits` and `DocPathSegment` (`internal/getDocPathSegments.ts`). Task 02_04 made every snapshot expose `pathSegments` and print numbered parents.
- `compareDocPaths(a, b)` walks two `DocPathSegment[]` level by level: collection name by code unit, then number (undefined as 0), and a shorter path (the parent) first. Comparing names whole keeps `order` and its subcollections ahead of `order-location`, which a sort over rendered text gets wrong because `-` sorts before `/`.
- `formatDBChanges.ts` (working tree) builds one `Section` per added, modified and removed snapshot and sorts by `compareDocPaths`, then `KindOrder` (ADDED, MODIFIED, REMOVED), then body by code unit, so read order cannot churn a snapshot. HEAD sorted the rendered strings, which grouped all ADDED sections first.
- `formatDBChanges.test.ts` (working tree): the first test's expected order changes (MODIFIED `entries/[ID]` now precedes ADDED `spaces/[ID]`), and two tests are added (`puts each document directly above the documents in its subcollections`, `keeps a collection apart from one whose name starts the same`).
- `getDBChangesDiff.test.ts` (working tree) adds `names a parent by number and lists its children under it`.
- README (`packages/firebase-kit-admin/README.md`, new paragraph before the masks paragraph near line 564) and the `getDBChangesDiff` JSDoc explain `[ID]`, numbered parents, ranking by pre-test content, and path ordering.
- Release rules (CLAUDE.md `## Releasing`): the squashed commit message decides the release and a breaking change must carry a `BREAKING CHANGE:` footer. The branch already carries one in the `Task 01_02` commit (`d1e0adb`). `.mise/spec.md` `## Hard-to-undo` explains why each footer is a single line.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. Read the working-tree diffs against the description above.
2. README checks (CLAUDE.md `## Documentation conventions`): no dependency version restated, no install block added. Confirm the paragraph matches the code. Parents are ranked by pre-test content, pre-existing documents come first, identical siblings share a number (the paragraph starting at `packages/firebase-kit-admin/README.md:564` and the `getDBChangesDiff` JSDoc do not say this yet; add that sentence to both), numbers show in the parent collection's own sections only when the diff holds a changed subcollection document, and sections sort by path.
3. Run the checklist (`.claude/mise-checklist.md`), rule 7 especially over the README paragraph and JSDoc. Fix only failures.
4. Stage exactly these seven files. Confirm `git status --short packages` is empty afterwards apart from what you staged, then commit with this message (the footer is one line, followed by the attribution trailer):

   ```text
   Task 02_05: sort getDBChangesDiff sections by path before kind

   <Key changes / Deviations body, as in earlier task commits>

   BREAKING CHANGE: getDBChangesDiff output now names a subcollection document's parent by its number among its siblings instead of a content hash, prints that number in the parent collection's own sections, and sorts sections by path before kind, so existing getDBChangesDiff and expectNoDBChanges snapshots must be re-recorded.
   ```

## Gotchas

- This task commits work that already sits, uncommitted, in the working tree. Do not rewrite it. Fix only what fails a check or the checklist.
- The `BREAKING CHANGE:` line must be a single line, starting at column 0, with nothing wrapped onto a following line.
- Run the checks on the committed tree. After this task there should be nothing left under `packages/` to stash, so `git status --short packages` empty is itself the isolation check.
- `.mise/spec.md` is modified in the working tree by the orchestrator. Do not stage it.

## Verification

Run from the repo root: `yarn format` (confirm no change outside this task), `yarn lint`, `yarn build`, `yarn test:unit`, `yarn test:emulator`. Then `git status --short packages` prints nothing, and `git log -1 --format=%B` shows the footer line intact.

Tests this task commits:

- `compareDocPaths.test.ts` (new).
- `formatDBChanges.test.ts`: the reordered envelope snapshot and the two new ordering tests, which fail on the 02_04 commit (rendered-text sort).
- `getDBChangesDiff.test.ts`: `names a parent by number and lists its children under it`, which fails on the 02_04 commit because the ADDED child would print above its MODIFIED parent.

README and JSDoc have no test. They are prose only (no snippet changes), so the substitute check is reading them against the code per step 2.
