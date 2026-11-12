Investigate the following tasks. Do not take them as required. Investigate first whether they make sense from your own critical perspective.

6hGp28W6vMJvWjqF [infra] add a get-docs-from-query helper to firebase-kit-admin
6hJJxHWFQh2QGmGm [feat] add a typed getDocuments(refs) batched-read helper to firebase-kit-admin
6hGwh3VxJ7q6V7fm [infra] add a snapshot-diff helper to firebase-kit-admin testing
6hJHFjjvWRW36Hqm [feat] mask db-diff values after comparison so masked field changes still show add/remove
6hMmCqJ8qgr4C3vF [infra] derive the cloud-task log label from data.action in firebase-kit
6hJH7xHG2F5MVJrF [spike] evaluate a firebase-kit API to drop the vitest server.deps.inline requirement in consumers

## Investigation

None of the six is a bug fix, so there was nothing to reproduce. All paths are
under `/Users/eric/Code/firebase-kit/packages`.

1. **get-docs-from-query (admin)** — nothing like it exists yet. The
   `{ id, ...data }` mapping to follow is at
   `firebase-kit-admin/src/firestore/checkDocumentInQueryExists.ts:67`, with the
   optional `reader?: TransactionReader` at :8 and :36. The client already has
   the same helper as `getDocs`, returning `T[]` with `T extends WithID<DBT>`
   (`firebase-kit-client/src/firestore/internal/getDocs.ts:26-39`). The new
   helper would be a top-level export in
   `firebase-kit-admin/src/firestore/index.ts:1-3`, with a colocated
   `*.emulator.test.ts`.
2. **getDocuments(refs) (admin)** — partly exists already.
   `TransactionReader.getAll(...refs)` is at
   `firebase-kit-admin/src/firestore/internal/TransactionReader.ts:56-60` and is
   tested at `TransactionReader.emulator.test.ts:46`. The Firestore mock already
   has `getAll` (`firebase-kit-admin/src/mocks/createFirebaseAdminFirestoreMock.ts:17,81`).
   The description does not say what happens to a missing ref (skip,
   `undefined`, or throw). `checkDocumentExists` throws `FunctionsInternalError`
   for one missing doc (`checkDocumentExists.ts:28-36`). Tasks 1 and 2 should
   share one design, reader optional in both.
3. **snapshot-diff helper (admin testing)** — largely redundant.
   `getDBSnapshot` → `getDBChanges` → `getDBChangesDiff` already does it
   (`firebase-kit-admin/src/testing/getDBSnapshot.ts:23`, `getDBChanges.ts:22`,
   `getDBChangesDiff.ts:10`), and the README shows it as a 4-line pattern
   (`firebase-kit-admin/README.md:541-548`). The only gap left is a
   before/run/after wrapper. If built, it goes in
   `firebase-kit-admin/src/testing/index.ts:5-7`.
4. **Masking db-diff values after comparison (admin testing)** — masking runs
   before the diff and replaces each value with a type token
   (`testing/internal/maskProps.ts:45`, called at `getDBChanges.ts:76,105,137`).
   A masked field that changes value but keeps its type is therefore invisible.
   Whether a doc counts as modified is decided by `updateTime`
   (`getDBChanges.ts:111`), not by data, so such a doc shows up as a MODIFIED
   header with an empty body (`getDiff` returns undefined → `''` at
   `getDBChangesDiff.ts:41`). A masked field that is added or removed already
   shows +/- with its token, because only `undefined` values are skipped
   (`maskProps.ts:41`). The real gap is changed values. A fix changes existing
   consumers' inline snapshots, so it is a behavior change for every masked
   suite. Existing mask tests are at `getDBChanges.test.ts:66,101`.
5. **Deriving the task log label from data.action (admin tasks)** — `taskName`
   is required (`tasks/types.ts:30`) and used at `createTaskEnqueuer.ts:29,44`.
   `TData extends object` (`createTaskEnqueuer.ts:19`) has no `action` field.
   The README example's data is `{ spaceId }` with no action
   (`firebase-kit-admin/README.md:474-478`), so a fallback is unavoidable. Making
   `taskName` optional is additive. Removing it is a breaking public API change
   and needs a `BREAKING CHANGE:` footer per CLAUDE.md. Test:
   `tasks/createTaskEnqueuer.test.ts:14-22`, whose fixture already has `action`.
   Docs to update: `README.md:478` and `:713-715`.
6. **Spike on dropping vitest server.deps.inline (client, not admin)** —
   consumers must inline both `getsetdel` and `firebase-kit-client`
   (`firebase-kit-client/README.md:111-137`). The package's own config only needs
   `getsetdel` (`firebase-kit-client/vitest.config.ts:21-27`). The cause is
   direct `getsetdel` imports in `getDocWithCache.ts:2`, `getDocsWithCache.ts:8`,
   `subscribeWithCache.ts:10`, `readThroughCache.ts:1-2` and `getMetadata.ts:1-2`
   under `firebase-kit-client/src/firestore/internal/`. Nothing in
   `FirestoreUtilsDependencies` injects the store. Two candidate fixes:
   - Inject the storage functions. This changes the `createFirestoreUtils` deps
     (public API).
   - Ship a vitest config helper under a new `exports` subpath
     (`firebase-kit-client/package.json` `exports`). This still inlines, it just
     hides it.

   `vitest` is already an optional peer (`firebase-kit-client/package.json:52-57`).

Hard to undo: public `exports` and peer changes in tasks 5 and 6, and the
default diff output in task 4. All three packages version together, so any
breaking change bumps the major on all of them (CLAUDE.md "Releasing"). None of
the tasks writes data or adds migrations.

## Open questions

Round 1 — which of the contested tasks stay in the run (tasks 1, 2 and 5 hold
up; their design questions follow in round 2):

1. Task 3 (snapshot-diff helper): drop it, or build only the before/run/after
   wrapper? Owner's note: the task was about making the repetitive 4-line
   pattern in each emulator test shorter and more readable — which is the
   wrapper. Two shapes are on the table: (i) keep `getDBSnapshot` for the
   before snapshot and add one call that replaces the after/changes/diff lines,
   suggested by the owner; (ii) one call that takes the code under test as a
   callback. Driver recommends (i): the code under test stays a plain statement,
   so its return value and thrown errors need no special handling. Whether a
   snapshot already carries its refs (so the new call need not take them again)
   is for the planner to check. Awaiting a confirmed pick.
2. Task 4 (mask after comparison): reframe to "a masked field whose value
   changes shows as changed" — as the new default, behind an opt-in option, or
   drop?
3. Task 6 (spike on `server.deps.inline`): its own branch, a written evaluation
   in this run, or evaluate and build the winner in this run?

Round 2 (pending round 1):

- Task 2: what a missing ref returns (skip, `undefined`, or throw).
- Task 5: `taskName` stays required with `data.action` preferred when present,
  or becomes optional.
- Task 4, if kept as the new default: whether the release treats the changed
  diff output as breaking.
