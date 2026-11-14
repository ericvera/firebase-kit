# 02_01 Split maskPath helpers into one file per function (add the new files)

## Goal

Commit the three new single-function modules `isMap.ts`, `readPath.ts` and `writePath.ts` with their tests. They already exist, uncommitted, in the working tree and carry the same code as the three exports of `internal/maskPath.ts`. This task only adds them. Task 02_02 points the callers at them and deletes `maskPath.ts`. The work is written; this task checks it and commits it, it does not rewrite it.

## Files to modify/create

All under `packages/firebase-kit-admin/src/testing/internal/`.

1. `isMap.ts` (new, already in the working tree)
2. `readPath.ts` (new, already in the working tree)
3. `writePath.ts` (new, already in the working tree)

Tests: `isMap.test.ts`, `readPath.test.ts`, `writePath.test.ts` (new, already in the working tree).

## Background

- Repo convention: one main export per file, file named for it, test beside it as `<name>.test.ts` (`.claude/mise-checklist.md` rule 2).
- `internal/maskPath.ts` (committed in task 01_01, commit `30ed90d`) exports `isMap`, `readPath`, `writePath`. Its callers are `internal/maskProps.ts` and `internal/maskModifiedProps.ts` only. In HEAD they import from `./maskPath.js`.
- `readPath.ts` imports `isMap` from `./isMap.js`. `writePath.ts` has no imports. Behavior is identical to `maskPath.ts` in HEAD (compare with `git show HEAD:packages/firebase-kit-admin/src/testing/internal/maskPath.ts`).
- The three new test files hold the cases from `maskPath.test.ts` in HEAD, split by function.
- Amendment context (see `.mise/spec.md` `## Amendments`, 2026-11-14): the working tree also holds the uncommitted work of tasks 02_02 to 02_05. Leave it in place and uncommitted.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. Diff the new modules against HEAD's `maskPath.ts` and confirm each function body matches. The only intended difference is the file split (`readPath` importing `isMap`).
2. Confirm each new test file covers its function the way `maskPath.test.ts` did, so nothing was lost in the split (`git show HEAD:packages/firebase-kit-admin/src/testing/internal/maskPath.test.ts`).
3. Run the review checklist (`.claude/mise-checklist.md`) over these six files. Fix only failures.
4. Stage exactly these six files and commit as `Task 02_01: split maskPath helpers into isMap, readPath and writePath`.

## Gotchas

- This task commits work that already sits, uncommitted, in the working tree beside the work of later tasks. Do not rewrite it. Fix only what fails a check or the checklist, and commit only this task's files.
- The full tree passing proves nothing about this commit alone. After committing, run `git stash push --include-untracked -- packages` so later tasks' leftovers under `packages/` leave the tree (`.mise/` stays out of the stash because the orchestrator writes there), run the checks on the clean HEAD, then `git stash pop`. If a check is red, fix this task's files, `git commit --amend`, re-run, and only then pop. Always pop, even on failure, so no later work is lost, and confirm `git stash list` is back to what it was.
- In this commit `maskPath.ts` and the new files coexist, duplicating code until 02_02. No lint rule flags unused exports, so this stays green.
- Do not stage `maskProps.ts`, `maskModifiedProps.ts` or the `maskPath` deletions. Those belong to 02_02.
- Test file conventions (CLAUDE.md): `vi.mock` directly below imports, `vi.hoisted` above them, everything else below.

## Verification

Run from the repo root on the isolated HEAD: `yarn format` (then confirm it changed nothing outside this task's files), `yarn lint`, `yarn build`, `yarn test:unit`.

Tests this task commits: `isMap.test.ts`, `readPath.test.ts`, `writePath.test.ts`. No behavior changes, so checklist rule 5 is n/a (pure move).
