# 04_01 Task data must carry a string action; label task logs from data.action directly

## Goal

The enqueue function `createTaskEnqueuer` returns is typed
`<TData extends { action: string }>`, and `EnqueueTaskOptions` is constrained
the same way. Both log lines use `data.action` directly as their label. The
module-level `getAction` helper, its cast through `unknown` and the `unnamed`
fallback are deleted. Task data without a string `action` no longer compiles.
This is a breaking public API change (see Gotchas on the release footer).

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/tasks/types.ts` (modify)
- `src/tasks/createTaskEnqueuer.ts` (modify)
- `README.md` (modify, the `firebase-kit-admin/tasks` prose and API Reference only)

Tests (do not count): `src/tasks/createTaskEnqueuer.test.ts`.

## Background

- Task 02_01 (done, `.mise/tasks/done/02_01_remove_task_name.md`) removed
  `EnqueueTaskOptions.taskName` and left this state:
  - `src/tasks/types.ts:12`: `export interface EnqueueTaskOptions<TData> {`,
    with `data: TData` at `:21`. No constraint, no default.
  - `src/tasks/createTaskEnqueuer.ts:7-11`: module-level
    `const getAction = (data: object): string | undefined`, which casts
    `data as { action?: unknown }` and returns `action` only when it is a
    string.
  - `src/tasks/createTaskEnqueuer.ts:23-24`: function JSDoc sentence "Both log
    lines are labeled with `data.action` when it is a string, else `unnamed`."
  - `src/tasks/createTaskEnqueuer.ts:28`: `async <TData extends object>({ ... }: EnqueueTaskOptions<TData>)`.
  - `src/tasks/createTaskEnqueuer.ts:36`: `const label = getAction(data) ?? 'unnamed'`,
    used in the `logger.info` calls at `:39` and `:54`.
  - `src/tasks/createTaskEnqueuer.ts:44`: `getFunctions().taskQueue<TData>(queueName)`.
    firebase-admin declares `taskQueue<Args = Record<string, any>>` with no
    constraint, so a constrained `TData` still fits.
- Tests at `src/tasks/createTaskEnqueuer.test.ts`: fixture `createOptions()` at
  `:15-22` already has `data: { action: 'expire-entry', entryId: 'entry-1' }`.
  The `unnamed` test at `:144-155` passes `data: { entryId: 'entry-1' }` and
  `data: { action: 42 }`, which stop compiling under the new constraint. The
  `taskName` regression test at `:168-179` (a `@ts-expect-error` on an excess
  property) stays as it is.
- Admin README:
  - `README.md:489-490` (prose under `### firebase-kit-admin/tasks`): "Both log
    lines are labeled by `data.action` when it is a string, else `unnamed`."
  - `README.md:497-514`: the example declares
    `interface SpaceCleanupData { action: 'space-cleanup'; spaceId: string }`
    and calls `enqueueTask<SpaceCleanupData>(...)`. It already satisfies the
    constraint; leave it.
  - `README.md:782-783` (API Reference): "**`EnqueueTaskOptions`**: `queueName`,
    `taskId`, `data`, `delayMs`, `dispatchDeadlineSeconds`, `logContext`."
- Unaffected and must still type-check: `src/testing/createTaskRequest.ts`
  (`createTaskRequest = <T>(data: T)`, unconstrained) and the functions mock
  (`src/mocks/createFirebaseAdminFunctionsMock.ts`,
  `src/__mocks__/firebase-admin/functions/index.ts`), whose `enqueue` spy takes
  `data: unknown`. Neither imports `EnqueueTaskOptions`. Do not change them.
- Owner decision (amendment 2026-11-13, in a review note asking for better types
  than `object` and `unknown`): task data must carry a string `action`. This
  supersedes 02_01's "`TData extends object` stays; callers whose data lacks
  `action` get `unnamed`" design.
- `tsconfig.json` includes all of `src`, so `yarn build` type-checks test files
  and enforces every `// @ts-expect-error` in them.

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `src/tasks/types.ts`: change the declaration to
   `export interface EnqueueTaskOptions<TData extends { action: string }> {`.
   Add to the `data` JSDoc that it must carry a string `action`, which labels the
   log lines, for example
   `/** Payload the queue's handler receives. Its \`action\` labels the enqueuer's log lines. */`.
   Nothing else changes; add no generic default.
2. `src/tasks/createTaskEnqueuer.ts`:
   - Delete `getAction` (`:7-11`) and the blank line after it.
   - Change the generic to `async <TData extends { action: string }>(`.
   - Delete `const label = ...`. Use `data.action` directly in both log
     templates: `` `Skipping ${data.action} task enqueue in emulator` `` and
     `` `${data.action} task already exists, skipping` ``. Keep the log text
     otherwise unchanged.
   - Replace the JSDoc sentence with "Both log lines are labeled with
     `data.action`, which every task's data must carry."
3. `README.md` (admin):
   - `:489-490`: replace the sentence with "Both log lines are labeled by
     `data.action`, so task data must carry a string `action`." Re-wrap to the
     surrounding ~80-column width.
   - `:782-783`: make it read "**`EnqueueTaskOptions`**: `queueName`, `taskId`,
     `data` (must carry a string `action`), `delayMs`,
     `dispatchDeadlineSeconds`, `logContext`." Re-wrap.
   - Touch nothing else in the README. Task 03_04 rewrites the testing section,
     and its edits must survive.
4. `src/tasks/createTaskEnqueuer.test.ts`: replace the test at `:144-155`
   ("labels the emulator skip log unnamed when data has no string action") with
   a regression test that pins both the compile-time rejection and the removal of
   the fallback:

   ```ts
   it('rejects task data without a string action at compile time', async () => {
     const enqueueTask = createTaskEnqueuer({ inEmulator: () => true })

     // @ts-expect-error task data must carry an action
     await enqueueTask({ ...createOptions(), data: { entryId: 'entry-1' } })
     // @ts-expect-error the action must be a string
     await enqueueTask({ ...createOptions(), data: { action: 42 } })

     // Verify: there is no fallback label any more; a caller that slips past
     // the compiler gets data.action as passed
     expect(vi.mocked(logger.info).mock.calls).toEqual([
       ['Skipping undefined task enqueue in emulator', { entryId: 'entry-1' }],
       ['Skipping 42 task enqueue in emulator', { entryId: 'entry-1' }],
     ])
   })
   ```

   If `yarn build` reports "Unused '@ts-expect-error' directive" on either line,
   the inferred `TData` satisfied the constraint. Pass the type argument
   explicitly instead, e.g. `enqueueTask<{ action: string }>({ ...createOptions(), data: { entryId: 'entry-1' } })`,
   so the error is real. The other label tests, the `taskName` test and every
   other test stay unchanged.

## Gotchas

- Release footer: this change is breaking. The squashed commit that ships the
  branch must carry a `BREAKING CHANGE:` footer naming it alongside the earlier
  items, e.g.
  `BREAKING CHANGE: createTaskEnqueuer's enqueue function and EnqueueTaskOptions require task data with a string action, which labels the log lines; data without one no longer compiles, and the "unnamed" label is gone.`
  Put the same footer in this task's own commit message so the ship step finds
  it. Per repo CLAUDE.md, `!` after the type is not enough on its own.
- The working tree holds the owner's uncommitted dependency update
  (`package.json` files, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases/`). Do not
  stage, commit, revert or reformat any of it. Stage only the four files above
  by path (never `git add -A` / `git add .`), and format only the touched files
  (`yarn prettier --write <files>`), never `yarn format` over the repo.
- Do not touch `src/mocks/createFirebaseAdminFunctionsMock*.ts`. Their
  "unnamed" comments are about task ids, not this label.
- After the change,
  `grep -rn "unnamed\|getAction" packages/firebase-kit-admin/src packages/firebase-kit-admin/README.md`
  must hit only those mock comments.
- Test file convention (repo CLAUDE.md): `vi.mock` calls directly below the
  imports, and every other declaration below them. The file already follows it.
- Leave `.mise/` files alone.

## Verification

- `yarn lint` and `yarn build` (Check) pass. `yarn build` type-checks the
  README-shaped usage in the test fixture and enforces both new
  `@ts-expect-error` lines and the existing `taskName` one.
- `yarn test:unit` passes, including the new regression test "rejects task data
  without a string action at compile time" in
  `src/tasks/createTaskEnqueuer.test.ts`, and the unchanged
  `src/testing/createTaskRequest.test.ts` and
  `src/mocks/createFirebaseAdminFunctionsMock.test.ts`. No `*.emulator.test.ts`
  code is touched, so `yarn test:emulator` is not required.
- README example: the `src/tasks/enqueueSpaceCleanup.ts` block at
  `README.md:492-514` is unchanged and its data carries
  `action: 'space-cleanup'`. Confirm it still compiles by copying the block
  into a scratch file inside `packages/firebase-kit-admin/src` (importing from
  `./tasks/index.js` and `./runtime/index.js` instead of the package subpaths),
  running `yarn build`, then deleting the scratch file before committing.
- `git status` shows the owner's dependency files still modified and
  uncommitted.
