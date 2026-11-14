# 02_02 Point mask callers at the split helpers and delete maskPath

## Goal

Commit the import changes that make `maskProps.ts` and `maskModifiedProps.ts` use `isMap.ts`, `readPath.ts` and `writePath.ts`, and the deletion of `maskPath.ts` and `maskPath.test.ts`. The edits are already in the working tree, uncommitted. This task checks and commits them, it does not rewrite them.

## Files to modify/create

All under `packages/firebase-kit-admin/src/testing/internal/`.

1. `maskProps.ts` (imports only, already edited)
2. `maskModifiedProps.ts` (imports only, already edited)
3. `maskPath.ts` (delete, already deleted in the working tree)

Tests: `maskPath.test.ts` (delete, already deleted in the working tree).

## Background

- Task 02_01 committed `isMap.ts`, `readPath.ts`, `writePath.ts` with tests. They carry the same code as `maskPath.ts`.
- The working-tree diff of `maskProps.ts` replaces `import { readPath, writePath } from './maskPath.js'` with two imports from `./readPath.js` and `./writePath.js`. The diff of `maskModifiedProps.ts` replaces the `./maskPath.js` import with imports from `./isMap.js`, `./readPath.js`, `./writePath.js`. Nothing else changes in either file.
- No other file imports `./maskPath.js` (check with `grep -rn maskPath packages/`).
- The working tree also holds the uncommitted work of tasks 02_03 to 02_05. Leave it in place.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. Confirm `git diff -- packages/firebase-kit-admin/src/testing/internal/maskProps.ts packages/firebase-kit-admin/src/testing/internal/maskModifiedProps.ts` shows import lines only.
2. Confirm nothing in `packages/` still references `maskPath`, including README and JSDoc.
3. Run the checklist (`.claude/mise-checklist.md`). Fix only failures.
4. Stage the two edits and the two deletions (`git add` and `git rm --cached` or `git add -A` on exactly those paths) and commit as `Task 02_02: import the split mask helpers and delete maskPath`.

## Gotchas

- This task commits work that already sits, uncommitted, in the working tree beside the work of later tasks. Do not rewrite it. Fix only what fails a check, and commit only this task's files.
- After committing, run `git stash push --include-untracked -- packages` so later tasks' leftovers under `packages/` leave the tree (`.mise/` stays out of the stash), run the checks on the clean HEAD, then `git stash pop`. If a check is red, fix this task's files, `git commit --amend`, re-run, and only then pop. Always pop, even on failure, and confirm `git stash list` is back to what it was.
- `.mise/spec.md` `## Design` still names `maskPath.ts`. Leave it, the amendment records the split and `.mise/` is removed before merge.

## Verification

Run from the repo root on the isolated HEAD: `yarn format` (confirm no change outside this task), `yarn lint`, `yarn build`, `yarn test:unit`, `yarn test:emulator` (mask code backs the emulator suites' diffs).

No new tests. The existing `maskProps.test.ts`, `maskModifiedProps.test.ts` and `getDBChanges.test.ts` cover the callers, and `isMap.test.ts`, `readPath.test.ts`, `writePath.test.ts` replace `maskPath.test.ts`. Checklist rule 5 is n/a (pure move).
