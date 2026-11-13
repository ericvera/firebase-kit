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

## Task descriptions

Read from the owner's task tracker on 2026-11-12, after the investigation above
had run on the titles alone. Summarized without the consuming app's name, file
names or branch names, because this directory is committed.

1. **get-docs-from-query** — the admin package has `checkDocumentExists`
   (single doc, throws) and `checkDocumentInQueryExists` (first match or
   undefined) but nothing for reading many docs from a query, so every
   multi-doc call site in the consuming app repeats
   `snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))`. Add a typed
   helper (`getDocsFromQuery` or similar) that returns the mapped entities.
2. **getDocuments(refs)** — Firestore's instance-level `getAll` lacks the
   generic overload that `Transaction.getAll` has, so callers hand-write a type
   assertion. A wrapper that preserves the ref's document type removes the cast
   at every call site.
3. **snapshot-diff helper** — tests write
   `getDBChangesDiff(getDBChanges(before, after))` and then assert on the
   result. The task asks for a helper that takes the before and after snapshots
   and returns the diff directly, skipping the intermediate changes object.
   About 309 tests in the consuming app use the two-step form.
4. **mask after comparison** — a masked field whose value changed renders as
   one unchanged context line (`"field": "/String/"`), so the change is
   invisible; a consumer test needed a hand-written `not.toBe` to cover an
   overwrite. Proposed: compare the normalized-but-unmasked data, then mask the
   rendered diff, so a changed masked value shows as `- /String/` / `+ /String/`
   lines with the content still hidden. Alternative considered: indexed tokens
   (`/String 000/` vs `/String 001/`, mirroring the existing
   `/Timestamp NNNN/`); masking after comparison keeps tokens stable across
   runs.
5. **task log label** — `taskName` never reaches Cloud Tasks; it is only
   interpolated into two `logger.info` lines. Every caller in the consuming app
   already passes `data.action`, and its `taskName` and `action` vocabularies
   had drifted apart. Derive the label from `data.action`; make `taskName`
   optional first so consumers keep compiling, then remove it in a later release
   once they stop passing it.
6. **spike** — consumers must add the kit packages (`firebase-kit-admin` or
   `firebase-kit-client`, plus `firebase-kit-protocol` and `getsetdel`) to
   `server.deps.inline` so their `vi.mock('firebase-functions')` /
   `vi.mock('firebase/functions')` keep intercepting the imports the kit makes
   internally. Evaluate whether the kit can accept its firebase collaborators as
   injected dependencies (`createActionableFunctionCaller` already takes
   `dependencies.functions`), or ship a documented vitest preset. Compare with
   `getsetdel`, whose README documents the same inline requirement as the
   ecosystem-standard answer.

What the descriptions change against the investigation:

- Task 3: the task asks for less than the decision below — it keeps the after
  snapshot in the test and only folds the two nested calls into one. The owner
  confirms which shape.
- Task 5: the task settles that `taskName` becomes optional now and is removed
  in a later release.
- Task 6: wider than the investigation, which covered only the client's
  IndexedDB path. It spans all three packages and the mocking of firebase
  modules inside the kit. If it stays in this run it needs a fresh
  investigation.

## Decisions

- **Task 3 (snapshot-diff helper) — in scope.** The owner's intent is to make
  the repetitive pattern in each emulator test shorter and more readable. Keep
  `getDBSnapshot` for the before snapshot and add one call that replaces the
  after/changes/diff lines; the code under test stays a plain statement between
  the two (not a callback). The three existing functions stay exported. The
  README example at `firebase-kit-admin/README.md:527-550` moves to the new
  call.

- **Task 2 (`getDocuments(refs)`) — a missing document comes back as
  `undefined` in its position**, so the result lines up with the refs passed
  in. It is neither skipped nor thrown.

- **Task 5 (task log label) — in scope, `taskName` becomes optional**, as the
  task description asks. Removing it is a later, breaking release and is out of
  scope here.

- **Consumer follow-ups are out of scope.** Each task names call sites to update
  in the consuming app; those live outside this repo.

## Assumptions

- Task 3: the planner checks whether a snapshot already carries its refs; if it
  does not, the new call takes `refs` again or the snapshot starts carrying
  them. The helper's name is also the planner's to propose.
- Tasks 1 and 2 are in scope and share one design (typed `{ id, ...data }`
  results, optional `TransactionReader`).
- Task 5: a `taskName` that is passed still labels the log lines, `data.action`
  labels them when `taskName` is omitted, and a generic label is used when
  neither exists. Existing callers therefore see no change. `taskName` is marked
  `@deprecated`.

## Open questions

Asked, awaiting the owner's pick:

1. Task 3 (snapshot-diff helper): keep the decided shape (the new call also
   takes the after snapshot), switch to the task's narrower helper (before and
   after in, diff out), or build both?
2. Task 4 (mask after comparison): as the new default, behind an opt-in option,
   or drop?
3. Task 6 (spike on `server.deps.inline`): its own branch, a written evaluation
   in this run, or evaluate and build the winner in this run?

Next round:

- Task 4, if kept as the new default: whether the release treats the changed
  diff output as breaking.
