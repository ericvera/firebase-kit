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
  call. Confirmed again after the task description was read: the owner prefers
  the new call to take the after snapshot internally over the task's narrower
  before-and-after-in helper.

- **Task 2 (`getDocuments(refs)`) — a missing document comes back as
  `undefined` in its position**, so the result lines up with the refs passed
  in. It is neither skipped nor thrown.

- **Task 5 (task log label) — in scope, `taskName` becomes optional**, as the
  task description asks. Removing it is a later, breaking release and is out of
  scope here.

- **Consumer follow-ups are out of scope.** Each task names call sites to update
  in the consuming app; those live outside this repo.

- **Task 3 — the snapshot remembers its refs.** `getDBSnapshot` records, in a
  hidden side table keyed by the array it returns, the refs that array was taken
  from; the new call reads them to take the after snapshot, so its arguments are
  the before snapshot and the optional masks. A snapshot it has no record of (a
  copy made with `slice`, spread or `filter`) makes the new call throw a clear
  error. No existing signature or exported type changes.

- **Task 6 (spike) — closed as "leave it as documented"; nothing is built.** The
  run fixes the two README gaps the investigation found instead: the admin
  README states the `server.deps.inline` requirement its mocks depend on, and the
  client README gives the full set of reasons for the line (its
  `firebase/functions` and `firebase/app` mocks, not only the IndexedDB fake).
  `firebase-kit-protocol` needs no inlining and is not listed.

- **Task 4 (masked field changes) — in scope, as the new default, through
  distinct mask tokens.** This replaces the earlier "both lines print the same
  token" decision. In a modified document, a masked field whose value changed
  gets one token on the before side and a different token on the after side —
  the existing type token with a label added — so plain jest-diff prints the
  `-` / `+` pair exactly as it prints any other change. A masked field that did
  not change, and every masked field of an added or removed document, keeps the
  plain token (`"/String/"`), so snapshots without a masked change are
  untouched. The label depends only on whether the value changed, never on the
  value, so it is stable from run to run for randomly generated values. A
  document whose only change is a masked field no longer prints an empty body.
  There is no opt-in switch and no special case for timestamps: a masked
  Timestamp that was rewritten shows as changed too (the owner rarely masks
  timestamps, because the timestamp index already shows their changes). No new
  dependency — `pretty-format` is not added — and no editing of printed text.
  The labels are `(before)` and `(after)`, added inside the existing type token:
  `"/String (before)/"` on the before side and `"/String (after)/"` on the
  after side, and likewise for every other type token.

- **Release — one regular feature.** Everything on this branch squashes into one
  `feat:` commit with no `BREAKING CHANGE:` footer; the owner chose to ship the
  changed diff output as a regular feature.

## Assumptions

- Task 3: the helper's name is the planner's to propose.
- Task 4 — the driver's reasoning, for the planner to confirm against the code:
  a mask token is always a one-line string, and the masking step for a modified
  document has both values at hand, so it can decide per masked field whether
  to emit the plain token or the labeled pair. No public signature changes.
- Tasks 1 and 2 are in scope and share one design (typed `{ id, ...data }`
  results, optional `TransactionReader`).
- Task 5: a `taskName` that is passed still labels the log lines, `data.action`
  labels them when `taskName` is omitted, and a generic label is used when
  neither exists. Existing callers therefore see no change. `taskName` is marked
  `@deprecated`.

## Investigation round 2

The owner asked for three things to be investigated before picking:

1. **Task 3 — does a snapshot carry its refs?** Does the value `getDBSnapshot`
   returns include the refs (or queries) it was taken from? If not, can it start
   carrying them without affecting existing code — existing callers of
   `getDBSnapshot`, `getDBChanges` and `getDBChangesDiff`, anything that
   serializes, compares or iterates a snapshot, and the snapshot's exported
   type? What is the least intrusive way for the new call to take the after
   snapshot itself?
2. **Task 4 — a concrete example.** The owner does not follow the change in the
   abstract. Using the real rendered format (from the existing tests and their
   inline snapshots), produce one small worked example: a document with a
   masked string field whose value is overwritten and one unmasked field that
   also changes — the exact diff text today, and the exact diff text after
   masking moves to after the comparison. Add the same pair for a document where
   only the masked field changes. Note how timestamps render today
   (`/Timestamp NNNN/`) and whether they already show as changed.
3. **Task 6 — what this is and why the owner would want it.** The owner has no
   picture of this task. Across all three packages, establish: what a consumer
   has to put in its vitest config today and what breaks without it; which
   imports inside the kit a consumer's `vi.mock` has to reach, and from which
   entry points; which kit APIs already take their firebase collaborators as
   injected dependencies and which import them directly; what each candidate
   (injected dependencies everywhere, a documented vitest preset, leaving it as
   documented) would change for a consumer and what it would cost in this repo,
   including public API and breaking changes; and whether the requirement is
   avoidable at all. End with a plain recommendation on whether it is worth
   doing.

Report. All paths are under
`/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/src` unless they name
another package. Nothing was changed. The diff texts came from running the built
`dist/testing` code on fixtures in the style of the unit tests; the "proposed"
texts are simulated by diffing unmasked data and then swapping the masked value
for its token.

**Task 3 — snapshot refs**

- A snapshot does not carry its refs. `getDBSnapshot` resolves its inputs to
  queries and returns a bare `Promise<QueryDocumentSnapshot[]>`
  (`testing/getDBSnapshot.ts:23-35`). Its exported types are only
  `TestableDBRef` and `SnapshotInput` (:8-13); no snapshot type is exported.
- What reads a snapshot today: `getDBChanges` sorts both arrays in place, so
  array identity survives (`getDBChanges.ts:59-71`, pinned by
  `getDBChanges.test.ts:143`). Change objects keep `afterDocs`/`beforeDocs` to
  compute paths (`DocumentChangeSnapshot.ts:105-108`).
  `getDBSnapshot.test.ts:64` asserts `toEqual([])`. The repo's only callers are
  `createRunBatch.emulator.test.ts:27,38,63,79`,
  `createRunTransaction.emulator.test.ts:27,42` and `README.md:541-548`.
- An enumerable property on the array would break `toEqual` and
  `toStrictEqual`. A non-enumerable property, or a module-level `WeakMap` keyed
  by the returned array, stays invisible to iteration, spread, JSON and
  equality. Both are lost on any copy (`slice`, spread, `filter`).
- Least intrusive: a `WeakMap` side table written by `getDBSnapshot` and read by
  the new call, which throws if the array is not registered. No signature or
  type changes; the three existing functions stay untouched. The fallback with
  no hidden state is for the new call to take the refs again:
  `(refs, before, masks?)`.

**Task 4 — worked example** (masked `secret`, header
`MODIFIED (path: entries/[ID])`)

- Today, `secret` overwritten and `name` changed — the secret shows as an
  unchanged context line:

  ```
    Object {
  -   "name": "Draft",
  +   "name": "Final",
      "secret": "/String/",
    }
  ```

- Proposed, same document (jest-diff groups the `-` lines ahead of the `+`
  lines):

  ```
    Object {
  -   "name": "Draft",
  -   "secret": "/String/",
  +   "name": "Final",
  +   "secret": "/String/",
    }
  ```

- Today, only the masked field changes — the header is followed by an empty
  body. The masked data are equal, so `getDiff` returns undefined
  (`DocumentChangeSnapshot.ts:28-30`) and renders as `''`
  (`getDBChangesDiff.ts:41`). The document is still listed because `updateTime`
  changed (`getDBChanges.ts:111`).
- Proposed, only the masked field changes (context lines appear because
  jest-diff's default `expand: true` overrides `contextLines: 0`,
  `DocumentChangeSnapshot.ts:17-26`):

  ```
    Object {
      "name": "Draft",
  -   "secret": "/String/",
  +   "secret": "/String/",
    }
  ```

- Timestamps: each Timestamp becomes `/Timestamp NNNN/`, indexed by its sorted
  position across both snapshots (`getDBChanges.ts:38-71`,
  `internal/normalizeData.ts:29-39`), so changes already show
  (`getDBChanges.test.ts:119-141`). Masking applies only to top-level fields
  (`internal/maskProps.ts:22`). A masked Map or Array value renders over several
  lines, so masking the rendered text is harder for those than for a string.

**Task 6 — the `server.deps.inline` requirement**

- Why it exists: vitest leaves ESM packages in `node_modules` to plain Node by
  default, and all three packages are `"type": "module"`. A consumer's
  `vi.mock` then never reaches imports made inside the kit. The only documented
  fix is `firebase-kit-client/README.md:111-137`,
  `server.deps.inline: ['getsetdel', 'firebase-kit-client']`; without it, cached
  reads fail with `ReferenceError: indexedDB is not defined`. The repo's own
  client config inlines only `getsetdel`, because it imports the kit from
  source (`firebase-kit-client/vitest.config.ts:27`).
- Admin imports a mock has to reach, none injected: `firebase-admin/functions`
  `getFunctions` in `tasks/createTaskEnqueuer.ts:1,34`; the `firebase-functions`
  `logger` at `createTaskEnqueuer.ts:2`, `errors/FunctionsError.ts:1` and
  `errors/logInvalidRequest.ts:1`; `firebase-admin/app`
  `getApp`/`getApps`/`initializeApp` at `createInit.ts:2` and
  `firestore/internal/createGetFirestore.ts:1-3`; `getAuth` at
  `auth/checkClaimsVersion.ts:1`.
- Client: callers inject `functions`, `firebaseApp`, `auth` and `appCheck`
  (`firebase-kit-client/src/callable/types.ts:44-112`) but still always import
  `httpsCallable` dynamically, even when `functions` is passed
  (`createActionableFunctionCaller.ts:49,56`), plus `getToken`
  (`internal/getTokenHeaders.ts:40`). The Firestore layer imports `getApp`,
  `getFirestore`, `getDoc`/`getDocs` and `onSnapshot`
  (`firestore/internal/getHostingFirestore.ts:17-30`, `subscribe.ts:20`) and
  `getsetdel` statically; `FirestoreUtilsDependencies` injects none of them
  (`firebase-kit-client/src/firestore/types.ts:266-290`).
- Protocol: `firebase-kit-protocol` has no runtime imports or dependencies, so
  inlining it does nothing. That contradicts the task description.
- Documentation gaps: the admin README never mentions `inline`, yet its mocks
  only reach the kit's own imports if `firebase-kit-admin` is inlined (for
  example the dedup path in `./tasks`, `README.md:558-620`). The client README
  gives `getsetdel` as the only reason, but the `firebase/functions` and
  `firebase/app` mocks at `README.md:620-695` depend on the same inline.
- Options compared:
  - Inject everything. Every listed API takes new required collaborators. A
    `BREAKING CHANGE:`, a major on all three packages, and the shipped `./mocks`
    factories become largely redundant. The only route that removes the
    requirement.
  - A vitest preset under a new `exports` subpath. Additive (a minor release),
    still inlines, and saves the consumer one line.
  - Leave it as documented. Costs nothing and matches the README answer
    `getsetdel` gives.
- Recommendation: not worth building. Close the spike as "leave it as
  documented", and spend a small docs change on the gaps above: add the inline
  requirement to the admin README and give the full set of reasons in the
  client README.

## Proposal

- **Issue:** five of the six backlog tasks hold up after investigation — two
  admin read helpers, a shorter snapshot-diff call, visible changes to masked
  fields, and an optional `taskName`; the sixth, the `server.deps.inline` spike,
  is not worth building.
- **Approach:** add a docs-from-query helper and `getDocuments(refs)` (typed
  `{ id, ...data }`, optional reader, a missing document is `undefined`); add
  one testing call that takes the after snapshot from the refs the before
  snapshot remembers and returns the diff; print a changed masked value as `-` /
  `+` lines by default; make `taskName` optional with `data.action` as the
  fallback label; fix the two README gaps about `server.deps.inline`. One
  `feat:` release, nothing breaking.
- **Skips:** none. The run adds public exports across three areas of the admin
  package, so spec and critic both run.

## Critic round 1

One blocking finding, accepted: task 4 reached further than the owner had
approved, because a masked Timestamp counts as changed every time it is
rewritten (the README masks `updated`). The owner re-confirmed the default with
that reach in view and changed the approach to distinct tokens; the result is
the Task 4 decision above.

Two minor findings, accepted: 01_02 cites line numbers past the end of
`internal/DocumentChangeSnapshot.ts` (the method is at :188-190, the module
function at :16-33); 01_05 must state the `root` setting outright, because the
admin README's mocks live under `src/__mocks__`.

## Critic rounds 2 and 3

Round 2 raised one blocking finding, accepted and fixed by the planner: 01_04
marked `taskName` `@deprecated` while still reading it, which the repo's
`@typescript-eslint/no-deprecated` rule rejects. The task now reads it on one
line under a stated lint exception and keeps `@deprecated`.

Round 3 raised no blocking finding. Two minor findings stand as notes:

- The reason comment 01_04 gives for that line is 92 characters at its indent,
  over the repo's 80-character limit for comments, so it has to be wrapped onto
  two lines.
- "Additive" overstates the `taskName` change. It is additive for callers that
  pass the option. Code that reads `taskName` from an `EnqueueTaskOptions` value
  now gets `string | undefined` and, under a strict lint config, a deprecation
  error. The release stays a plain `feat:` as the owner chose.
