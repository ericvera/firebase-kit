# 02_01 Remove taskName from EnqueueTaskOptions; label task logs from data.action only

## Goal

`EnqueueTaskOptions.taskName` is removed outright. The task enqueuer's two log
lines are labeled with `data.action` when it is a string, else `unnamed`. The
`@deprecated` JSDoc, the lint exception that read `taskName`, the `taskName`
tests and every README mention of `taskName` go. A caller that still passes
`taskName` in an object literal no longer compiles. This is a breaking public
API change (see Gotchas on the release footer).

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/tasks/types.ts` (modify)
- `src/tasks/createTaskEnqueuer.ts` (modify)
- `README.md` (modify)

Tests (do not count): `src/tasks/createTaskEnqueuer.test.ts`.

## Background

- Task 01_04 (done, `.mise/tasks/done/01_04_optional_task_name.md`) made
  `taskName` optional and `@deprecated`. Current state:
  - `src/tasks/types.ts:26-34`: the `taskName?: string` member of
    `EnqueueTaskOptions<TData>` with a JSDoc block holding `@deprecated`.
  - `src/tasks/createTaskEnqueuer.ts:7-11`: module-level
    `getAction(data: object): string | undefined` (returns `data.action` only
    when it is a string). Keep it.
  - `src/tasks/createTaskEnqueuer.ts:23-24`: the function JSDoc sentence
    "Both log lines are labeled with `taskName` when passed, else `data.action`
    when it is a string, else `unnamed`."
  - `src/tasks/createTaskEnqueuer.ts:28-42`: the parameter is
    `options: EnqueueTaskOptions<TData>`, destructured in the body, then a
    two-line reason comment, an
    `// eslint-disable-next-line @typescript-eslint/no-deprecated` and
    `const label = options.taskName ?? getAction(data) ?? 'unnamed'`.
  - `label` is used in the two `logger.info` calls at `:45` and `:60`.
- Tests at `src/tasks/createTaskEnqueuer.test.ts`: fixture `createOptions()`
  at `:15-23` includes `taskName: 'cleanup'` and
  `data: { action: 'expire-entry', entryId: 'entry-1' }`; label tests at
  `:135-181`. `logger.info` is a spy because the file calls
  `vi.mock('firebase-functions')` (shim at `src/__mocks__/firebase-functions/`).
- README mentions (admin README only; the client and protocol packages and the
  root README have none):
  - `README.md:489-491` (prose under `### firebase-kit-admin/tasks`): "Both log
    lines are labeled by `data.action`; the deprecated `taskName` still takes
    precedence when passed."
  - `README.md:783-785` (API Reference, `EnqueueTaskOptions`): "..., and the
    optional, deprecated `taskName` (pass the label as `data.action` instead)."
  - The code example at `README.md:500-514` already uses `data.action` and no
    `taskName`; leave it.
- Owner decision (amendment 2026-11-13, at review): remove `taskName` instead
  of deprecating it; label is `data.action`, else `unnamed`; ship as a breaking
  change. It supersedes 01_04's design.
- `TData extends object` (`createTaskEnqueuer.ts:28`) stays; no `action`
  constraint is added, because callers whose data lacks `action` must still
  compile and get `unnamed`.
- `tsconfig.json` includes all of `src`, so `yarn build` type-checks test
  files; a `// @ts-expect-error` in a test is enforced by `yarn build`.

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `src/tasks/types.ts`: delete the `taskName` member and its whole JSDoc block
   (lines 26-34). Nothing else changes.
2. `src/tasks/createTaskEnqueuer.ts`:
   - Replace the function JSDoc sentence with: "Both log lines are labeled with
     `data.action` when it is a string, else `unnamed`."
   - Delete the two-line reason comment and the `eslint-disable-next-line`
     line; the label line becomes
     `const label = getAction(data) ?? 'unnamed'`.
   - Optional simplification: the parameter may go back to being destructured
     directly (`async <TData extends object>({ queueName, taskId, data, delayMs, dispatchDeadlineSeconds, logContext }: EnqueueTaskOptions<TData>)`).
     Either form is fine; keep the log text otherwise unchanged.
3. `README.md` (admin):
   - `:489-491`: replace the sentence with "Both log lines are labeled by
     `data.action` when it is a string, else `unnamed`." (re-wrap to the
     surrounding ~80-column width).
   - `:783-785`: drop the `taskName` clause so it reads
     "`queueName`, `taskId`, `data`, `delayMs`, `dispatchDeadlineSeconds`,
     `logContext`." (keep the existing `- **`EnqueueTaskOptions`**:` lead-in).
4. `src/tasks/createTaskEnqueuer.test.ts`:
   - Remove `taskName: 'cleanup'` from `createOptions()`.
   - Delete the test "labels the emulator skip log with taskName when it is
     passed" (`:135-144`).
   - In the remaining three label tests, drop the `const { taskName, ...options } = createOptions()`
     destructures (use `createOptions()` directly) and drop "when taskName is
     omitted" from their names, e.g. "labels the emulator skip log with
     data.action", "labels the emulator skip log unnamed when data has no string
     action", "labels the duplicate log with data.action".
   - Add a regression test that `taskName` no longer type-checks and is not
     used as a label:

     ```ts
     it('rejects taskName at compile time and labels from data.action', async () => {
       const enqueueTask = createTaskEnqueuer({ inEmulator: () => true })

       // @ts-expect-error taskName was removed; data.action is the label
       await enqueueTask({ ...createOptions(), taskName: 'cleanup' })

       // Verify: a caller that slips taskName past the compiler still gets the
       // data.action label
       expect(vi.mocked(logger.info).mock.calls).toEqual([
         ['Skipping expire-entry task enqueue in emulator', { entryId: 'entry-1' }],
       ])
     })
     ```

     Confirm the `@ts-expect-error` is actually needed: an object literal with
     a spread plus an explicit extra property triggers TypeScript's excess
     property check. If `yarn build` reports "Unused '@ts-expect-error'
     directive", the check did not fire; pass a full literal instead of a
     spread (all fields written out plus `taskName`).

## Gotchas

- Release footer: this change is breaking. The squashed commit that ships the
  branch must carry a `BREAKING CHANGE:` footer naming the removal, e.g.
  `BREAKING CHANGE: EnqueueTaskOptions.taskName is removed; task log lines are labeled by data.action (else "unnamed"). A caller that still passes taskName no longer compiles.`
  Put the same footer in this task's own commit message so the ship step finds
  it. Per repo CLAUDE.md, `!` after the type is not enough on its own.
- The working tree holds the owner's uncommitted dependency update
  (`package.json` files, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases/`). Do not
  stage, commit, revert or reformat any of it. Stage only the four files above
  by path (never `git add -A` / `git add .`), and do not run `yarn format` over
  the repo in a way that rewrites those files; format only the touched files
  (`yarn prettier --write <files>`).
- Do not touch `src/mocks/createFirebaseAdminFunctionsMock*.ts`; their
  "unnamed" comments are about task ids, not this label.
- After the change, `grep -rn taskName packages/` (excluding `node_modules`,
  `dist`) must hit only the new regression test.
- Test file convention (repo CLAUDE.md): `vi.mock` calls directly below the
  imports; every other declaration below them. The file already follows it.
- Leave `.mise/` files alone.

## Verification

- `yarn lint` and `yarn build` (Check) pass; `yarn build` enforces the
  `@ts-expect-error` in the new test.
- `yarn test:unit` passes, including the updated label tests and the new
  regression test in `src/tasks/createTaskEnqueuer.test.ts`. The change touches
  no `*.emulator.test.ts` code, so `yarn test:emulator` is not required.
- `grep -rn taskName /Users/eric/Code/firebase-kit/packages --exclude-dir=node_modules --exclude-dir=dist`
  shows only the regression test.
- `git status` shows the owner's dependency files still modified and
  uncommitted.
