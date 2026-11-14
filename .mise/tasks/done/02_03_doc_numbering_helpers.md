# 02_03 Add the document numbering helpers

## Goal

Commit five new pure helpers, with tests, that number documents among their siblings and build the printed path segments of a document. Nothing calls them yet. Task 02_04 wires them into `getDBChanges`. The code is already in the working tree, uncommitted. This task checks and commits it, it does not rewrite it.

## Files to modify/create

All under `packages/firebase-kit-admin/src/testing/internal/`, all new and already in the working tree.

1. `compareCodeUnits.ts`
2. `getCollectionPatterns.ts`
3. `getDocNumbers.ts`
4. `getParentPatterns.ts`
5. `getDocPathSegments.ts`

Tests: `compareCodeUnits.test.ts`, `getCollectionPatterns.test.ts`, `getDocNumbers.test.ts`, `getParentPatterns.test.ts`, `getDocPathSegments.test.ts` (all new, already in the working tree).

## Background

The amendment (`.mise/spec.md` `## Amendments`, 2026-11-14) changes `getDBChangesDiff` output. Today (HEAD, `internal/DocumentChangeSnapshot.ts`, `getNormalizedIDForPath`/`getDocPath`) a subcollection document's parent id prints as an md5 hash of the parent's content, so any edit to the parent changes every child's path. After the amendment it prints as the parent's number among its siblings, as in `order/[ID 1]/order--conversation-turns/[ID]`.

What each helper does:

- `compareCodeUnits(a, b)` orders strings by UTF-16 code unit, like a bare `Array.sort()`, without locale dependence. The existing `internal/ascCompare.ts` uses `localeCompare`, which is why it is not reused.
- `getCollectionPatterns(path)` returns each level's pattern, the path with document ids taken out (`spaces/s1/entries/e1` gives `['spaces', 'spaces/entries']`).
- `getDocNumbers(docs: NumberedDoc[])` returns `Map<path, number>`. Siblings (same parent collection path) are ranked by `existedBefore` first, then by a key-sorted serialization of `content`. Numbers start at 1, identical rank keys share a number. Uses `Map.groupBy`.
- `getParentPatterns(changedPaths)` returns the set of collection patterns that hold a parent of a changed document. Documents in those collections print their number in their own sections too.
- `getDocPathSegments(path, numbers, parentPatterns)` returns `DocPathSegment[]` (`{ collection, number }`, exported type). Ancestors always carry their number. The document itself carries one only when its collection pattern is in `parentPatterns`. An ancestor missing from `numbers` throws the same message HEAD's `getNormalizedIDForPath` throws (`Document not found for path: ... Add a ref or query covering the <collection path> collection to getDBSnapshot, so the ancestor is in the snapshot.`).

Dependencies inside this task: `getDocNumbers` imports `compareCodeUnits`. `getParentPatterns` and `getDocPathSegments` import `getCollectionPatterns`. None imports a file outside this task.

The working tree also holds the uncommitted work of tasks 02_04 and 02_05. Leave it in place.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. Read each helper against the behavior above and its test. Check edge cases the tests pin: identical siblings share a number, pre-existing documents rank before added ones, field order does not affect the rank, a missing ancestor throws, and a top-level document outside `parentPatterns` gets `number: undefined`.
2. Run the checklist (`.claude/mise-checklist.md`), paying attention to rule 6 and rule 7 (no colons, semicolons or em-dashes inside comment prose) in the JSDoc of these files. Fix only failures.
3. Stage exactly these ten files and commit as `Task 02_03: add helpers that number documents among their siblings`.

## Gotchas

- This task commits work that already sits, uncommitted, in the working tree beside the work of later tasks. Do not rewrite it. Fix only what fails a check or the checklist, and commit only this task's files.
- After committing, run `git stash push --include-untracked -- packages` so later tasks' leftovers under `packages/` leave the tree (`.mise/` stays out of the stash), run the checks on the clean HEAD, then `git stash pop`. If a check is red, fix this task's files, `git commit --amend`, re-run, and only then pop. Always pop, even on failure, and confirm `git stash list` is back to what it was.
- `Map.groupBy` needs the ES2024 lib. The full tree builds, so the tsconfig already allows it. If the isolated build complains, that is a real problem to report, not to work around.
- Do not stage `formatDocPath.ts` or `compareDocPaths.ts`. They belong to 02_04 and 02_05.

## Verification

Run from the repo root on the isolated HEAD: `yarn format` (confirm no change outside this task), `yarn lint`, `yarn build`, `yarn test:unit`.

Tests this task commits: the five `*.test.ts` files listed above. Each is new behavior with no previous implementation, so each test fails without its source file (checklist rule 5).
