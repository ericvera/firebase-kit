# 02_04 Name subcollection parents by number in diff paths

## Goal

Commit the change that makes `getDBChanges` number every document among its siblings and print paths from those numbers. A subcollection document's parent prints as `[ID n]` instead of a content hash, and a collection's documents print their number in their own sections whenever the diff holds a changed document from one of its subcollections. Section order is untouched here (task 02_05). The code is already in the working tree, uncommitted. This task checks and commits it, it does not rewrite it.

## Files to modify/create

All under `packages/firebase-kit-admin/src/testing/internal/`.

1. `formatDocPath.ts` (new, already in the working tree)
2. `DocumentChangeSnapshot.ts` (already edited)
3. `getDBChanges.ts` (already edited)

Tests: `formatDocPath.test.ts` (new), `DocumentChangeSnapshot.test.ts`, `getDBChanges.test.ts` (all already in the working tree).

## Background

- Task 02_03 committed `compareCodeUnits`, `getCollectionPatterns`, `getDocNumbers` (`NumberedDoc`), `getParentPatterns`, `getDocPathSegments` (`DocPathSegment`) in the same directory.
- `formatDocPath(segments)` renders `DocPathSegment[]` as `coll/[ID]` or `coll/[ID n]` joined by `/`.
- `DocumentChangeSnapshot.ts` (working tree): `getNormalizedIDForPath`, `getDocPath`, `generateHash` and the `node:crypto`, `extractTimestamps`, `normalizeData` imports are removed. Every snapshot class constructor takes `pathSegments: readonly DocPathSegment[]` in place of `allDocs`. The base class exposes `public readonly pathSegments` and sets `normalizedPath = formatDocPath(pathSegments)`.
- `getDBChanges.ts` (working tree) adds Step 3. It calls `getDocNumbers` over every before document (masked with plain tokens via `maskProps` on a fresh `{ ...doc.data() }` copy, then normalized) with `existedBefore: true`, plus every added document's already-masked data with `existedBefore: false`. Ranking a pre-existing document by what it held before the test means a write by the code under test cannot renumber it. Step 4 computes `getParentPatterns` from changed (added or modified) and removed paths, and builds each snapshot's segments with `getDocPathSegments`.
- The missing-ancestor error moved from `DocumentChangeSnapshot.ts` to `getDocPathSegments.ts` with the same text. Its tests moved from `DocumentChangeSnapshot.test.ts` to `getDBChanges.test.ts` (`throws when the parent of a subcollection document is not in the snapshot`) and `getDocPathSegments.test.ts`.
- Emulator suites (`src/firestore/internal/createRunBatch.emulator.test.ts`, `createRunTransaction.emulator.test.ts`) only print top-level `spaces/[ID]` sections, so their snapshots do not change.
- The working tree also holds the uncommitted work of task 02_05 (`compareDocPaths.ts`, `formatDBChanges.ts`, `getDBChangesDiff.ts`, `README.md` and the `formatDBChanges.test.ts`, `getDBChangesDiff.test.ts`, `compareDocPaths.test.ts` changes). Leave it in place.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. Read the working-tree diffs of the three source files against the description above.
2. Check the numbering inputs in `getDBChanges.ts`: the before-document content must be masked with the same mask keys as the diff and normalized with the same `sortedTimestamps`, so a masked field never decides a rank (pinned by `leaves masked fields out of the parent numbering`). Every timestamp in that re-masked copy is already in `sortedTimestamps`, because the before entries were masked on the same paths.
3. Confirm `DocumentChangeSnapshot.ts` has no leftover unused import or helper.
4. Run the checklist (`.claude/mise-checklist.md`). Fix only failures.
5. Stage exactly these six files and commit as `Task 02_04: name subcollection parents by their number among siblings`.

## Gotchas

- This task commits work that already sits, uncommitted, in the working tree beside the work of 02_05. Do not rewrite it. Fix only what fails a check or the checklist, and commit only this task's files.
- After committing, run `git stash push --include-untracked -- packages` so 02_05's leftovers under `packages/` leave the tree (`.mise/` stays out of the stash), run the checks on the clean HEAD, then `git stash pop`. If a check is red, fix this task's files, `git commit --amend`, re-run, and only then pop. Always pop, even on failure, and confirm `git stash list` is back to what it was.
- In this commit `formatDBChanges.ts` still sorts by the rendered section text (HEAD), which puts every ADDED section before MODIFIED and REMOVED. That is why `formatDBChanges.test.ts` and `getDBChangesDiff.test.ts` stay at HEAD here: their working-tree changes expect the new order and belong to 02_05. HEAD's `formatDBChanges.ts` reads only `normalizedPath` and `getDiff()`, so it compiles against the new constructors. No test still at HEAD prints a nested path, so numbering should not break either file. If a HEAD test in those two files does fail in isolation, do not edit it (both files are in the stash with 02_05's edits, and amending them before `git stash pop` would make the pop conflict): pop the stash and report the failure instead.
- Test file conventions (CLAUDE.md): `vi.mock` directly below imports, `vi.hoisted` above them, everything else below.

## Verification

Run from the repo root on the isolated HEAD: `yarn format` (confirm no change outside this task), `yarn lint`, `yarn build`, `yarn test:unit`, `yarn test:emulator`.

Tests this task commits:

- `formatDocPath.test.ts` (new).
- `DocumentChangeSnapshot.test.ts`: constructors take `pathSegments`. `prints the path segments it was given` replaces the hash and missing-ancestor tests.
- `getDBChanges.test.ts`: `numbers the parent in the path of a subcollection document`, `keeps the path of a child when the test rewrites its parent`, `names a parent the same for its added and its removed children`, `leaves masked fields out of the parent numbering`, `does not number a collection whose documents have no changed children`, `throws when the parent of a subcollection document is not in the snapshot`. The first four fail on HEAD (HEAD prints a hash), which satisfies checklist rule 5. `does not number a collection whose documents have no changed children` passes on HEAD, because a top-level path has no ancestors to hash; it is a guard test.
