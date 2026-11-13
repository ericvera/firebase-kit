# Spec: backlog helpers for firebase-kit-admin

## What

Five changes to `packages/firebase-kit-admin` plus two README fixes, released as
one commit carrying a `BREAKING CHANGE:` footer that names the removal of
`EnqueueTaskOptions.taskName` (amendment 02_01), the change of
`getDBSnapshot`'s return value from an array to a `DBSnapshot` object
(amendment 03_01), and the reshaped testing diff API (amendment 03_02:
`getDBChanges` and the changes-object types leave the public API,
`getDBChangesDiff` takes a before snapshot instead of a changes object, and
masked fields leave the timestamp numbering), which bumps the major on all
three packages.

1. **`getDocumentsFromQuery(query, reader?)`** (`firebase-kit-admin/firestore`):
   runs a query, through the `TransactionReader` when one is given, and returns
   every match as a typed `{ id, ...data }` entity. Replaces the
   `snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))` callers repeat.
2. **`getDocuments(refs, reader?)`** (`firebase-kit-admin/firestore`): batched
   read of many refs that keeps the refs' document type (Firestore's
   instance-level `getAll` loses it). Returns one entry per ref, in order: the
   `{ id, ...data }` entity, or `undefined` for a missing document. It never
   skips or throws for a missing document.
3. **Two calls on a before snapshot** (`firebase-kit-admin/testing`,
   amendments 03_01 and 03_02). `getDBSnapshot` returns an exported
   `DBSnapshot` object, `{ docs, refs }`, holding the documents and the inputs
   they were read from. **`getDBChangesDiff(before, masks?)`** re-reads
   `before.refs` and returns the printable `DB DIFF` string.
   **`expectNoDBChanges(before)`** re-reads the same refs and rejects, with the
   printed diff in the error message, when any document was added, removed or
   modified; it takes no masks. Together they replace the after/changes/diff
   lines of every emulator test; the code under test stays a plain statement
   between `getDBSnapshot` and either call. `getDBChanges(before, after,
   masks?)` and the old `getDBChangesDiff(changes)` become internal, and the
   changes-object types (`DBSnapshotChanges`, `AddedDocumentSnapshot`,
   `RemovedDocumentSnapshot`, `ModifiedDocumentSnapshot`,
   `UnmodifiedDocumentSnapshot`) stop being exported. The name
   `getDBDiffSince`, built earlier on this branch, never ships. There is no
   module-level state.
4. **Changed masked fields get labeled tokens** (default, no switch): in a
   modified document, a masked field whose value changed prints
   `"/String (before)/"` on the before side and `"/String (after)/"` on the after
   side (likewise for every other type token), so jest-diff shows the `-` / `+`
   pair. A masked field that did not change, and every masked field of an added
   or removed document, keeps the plain token. A document whose only change is a
   masked field no longer prints an empty body. No special case for timestamps:
   a masked Timestamp that was rewritten counts as changed. Masked fields are
   left out of the `/Timestamp NNNN/` numbering (amendment 03_02), so masking a
   timestamp no longer shifts the index of every other timestamp. A masked
   Timestamp prints its class name, `"/Timestamp/"` (`"/Timestamp (before)/"` /
   `"/Timestamp (after)/"` when its value changed), instead of today's
   `"/String/"` (owner addition to amendment 03_02).
5. **`taskName` optional** in `EnqueueTaskOptions`, marked `@deprecated`. The
   log label is `taskName` when passed, else `data.action` when it is a string,
   else `unnamed`.
6. **README gaps on `server.deps.inline`**: the admin README states the
   requirement its mocks depend on; the client README gives the full set of
   reasons (its `firebase/functions` and `firebase/app` mocks, not only the
   IndexedDB fake). `firebase-kit-protocol` is not listed. Nothing is built for
   the spike.

Item 5 is superseded by amendment 02_01: `taskName` is removed from
`EnqueueTaskOptions` and the log label is `data.action`, else `unnamed`.

Out of scope: consumer call-site updates; any vitest preset
or dependency injection for the spike.

## Design

All paths below are under `packages/firebase-kit-admin/src` unless they name
another package.

### Firestore read helpers (task 01_01)

Both follow `checkDocumentExists.ts` (positional optional `reader`) and the
`{ id, ...data } as T` mapping at `checkDocumentInQueryExists.ts:67-70`, with the
generic pair `<T extends DBT & { id: string }, DBT extends DocumentData>`.

```ts
export const getDocumentsFromQuery = async <
  T extends DBT & { id: string },
  DBT extends DocumentData,
>(query: Query<DBT, DBT>, reader?: TransactionReader): Promise<T[]>

export const getDocuments = async <
  T extends DBT & { id: string },
  DBT extends DocumentData,
>(
  refs: DocumentReference<DBT, DBT>[],
  reader?: TransactionReader,
): Promise<(T | undefined)[]>
```

- `getDocuments` returns `[]` for an empty `refs` without reading (Firestore's
  `getAll` requires at least one argument). With a reader it calls
  `reader.getAll(...refs)` (already typed, `internal/TransactionReader.ts:56`);
  without one it calls `refs[0].firestore.getAll(...refs)` and casts the result
  to `DocumentSnapshot<DBT, DBT>[]` once, inside the helper. A snapshot whose
  `data()` is `undefined` maps to `undefined`.
- Both export from `firestore/index.ts` with `export *`.

### Labeled tokens for changed masked fields (task 01_02)

Today `getDBChanges` masks each side (`internal/maskProps.ts`, in place) before
the comparison, so a masked field whose raw value changed but whose type token
did not prints the same token on both sides and is invisible. The fix makes the
masking step of a modified document, which has both normalized values at hand,
emit distinct tokens for a changed masked field; the diff stays plain jest-diff.

- `internal/maskProps.ts`: `getTypeToken(value, label?: 'before' | 'after')` is
  exported; with a label it returns `/<Type> (<label>)/` (`/String (before)/`),
  without one the plain token as today. `maskProps` behavior is unchanged.
- New internal `testing/internal/maskModifiedProps.ts`:
  `maskModifiedProps(before: unknown, after: unknown, collection: string,
  maskKeys: Record<string, string[]>): void`, masking both in place. For each
  masked key present (not `undefined`) on both sides whose normalized values
  differ by `isDeepStrictEqual` (`node:util`), before gets the `(before)` token
  and after the `(after)` token; every other present masked value gets the
  plain token. Non-object values fall back to `maskProps`.
- `getDBChanges.ts`: the added branch masks with `maskProps`; a doc present on
  both sides is masked with `maskModifiedProps` instead of two `maskProps`
  calls. The removed loop, the in-place sort and every constructor signature
  are unchanged. (03_03 moves masking ahead of normalization, see "Masked
  fields leave the timestamp numbering" below.)
- `internal/DocumentChangeSnapshot.ts` does not change: with distinct tokens,
  its existing jest-diff call prints the pair like any other change.
- The label depends only on whether the value changed, so output is stable
  across runs. Under 01_02 a masked Timestamp gets `/String/` (the masked
  value is already the string `/Timestamp NNNN/`), and a rewritten one
  `/String (before)/` / `/String (after)/`; there is no timestamp special case
  in the change test. From 03_03 on, masking sees the raw Timestamp and the
  tokens become `/Timestamp/`, `/Timestamp (before)/`, `/Timestamp (after)/`. A masked field whose
  type changed prints e.g. `/String (before)/` / `/Number (after)/` (today
  `/String/` / `/Number/`).
- No new dependency and no editing of printed text.

Worked output (masked `secret` overwritten, `name` also changed):

```
  Object {
-   "name": "Draft",
-   "secret": "/String (before)/",
+   "name": "Final",
+   "secret": "/String (after)/",
  }
```

Only the masked field changed:

```
  Object {
    "name": "Draft",
-   "secret": "/String (before)/",
+   "secret": "/String (after)/",
  }
```

### Two-call diff API (task 01_03, reshaped by amendments 03_01 and 03_02)

01_03 shipped `getDBDiffSince` with a module-level `WeakMap` side table
(`testing/internal/snapshotInputs.ts`) keyed by the array `getDBSnapshot`
returned. Amendment 03_01 (task 03_01) replaces that: the snapshot is a plain
object that carries its refs, and the side table and its error are deleted.
Amendment 03_02 (task 03_02) then cuts the public surface to two calls on a
before snapshot and renames `getDBDiffSince` to `getDBChangesDiff`.

- `getDBSnapshot.ts` exports (03_01):

  ```ts
  export interface DBSnapshot {
    docs: QueryDocumentSnapshot[]
    refs: SnapshotInput[]
  }

  export const getDBSnapshot = async (
    inputs: SnapshotInput | SnapshotInput[],
  ): Promise<DBSnapshot>
  ```

  `docs` is the flat list of every input's documents, in input order; `refs` is
  the normalized input array (a single input wrapped in an array). The fields
  are not `readonly`, because `getDBChanges` sorts `docs` in place.
- `getDBChanges(before: DBSnapshot, after: DBSnapshot, masks?):
  DBSnapshotChanges` (03_01 changes the parameters; 03_02 moves the file to
  `testing/internal/getDBChanges.ts` and drops it from `testing/index.ts`). It
  reads `before.docs` / `after.docs`, sorts them in place, and passes
  `after.docs` / `before.docs` to the `DocumentChangeSnapshot` constructors as
  before. `refs` is ignored.
- The old renderer `getDBChangesDiff(changes)` moves to
  `testing/internal/formatDBChanges.ts` as `formatDBChanges(changes:
  DBSnapshotChanges): string` (03_02). Its body and output are unchanged.
- `testing/getDBChangesDiff.ts` is the former `getDBDiffSince.ts`, renamed
  (03_02):

  ```ts
  export const getDBChangesDiff = async <TCollection extends string = string>(
    before: DBSnapshot,
    masks?: Partial<Record<TCollection, string[]>>,
  ): Promise<string>
  ```

  `getDBSnapshot(before.refs)` → `getDBChanges(before, after, masks)` →
  `formatDBChanges(changes)`. It has no error path of its own; any
  `{ docs, refs }` value works.
- New `testing/expectNoDBChanges.ts` (03_02):

  ```ts
  export const expectNoDBChanges = async (before: DBSnapshot): Promise<void>
  ```

  `getDBSnapshot(before.refs)` → `getDBChanges(before, after)` (no masks).
  When `added`, `removed` and `modified` are all empty it resolves. Otherwise
  it throws an `Error` whose message is `Expected no DB changes, found:`, a
  blank line, then `formatDBChanges(changes)`.
  "Modified" means what it means in the diff, a changed `updateTime`, so a
  document rewritten with identical data fails it with a `MODIFIED` header and
  an empty body. It throws a plain `Error` and imports nothing from `vitest`.
- `testing/index.ts` after 03_02 exports `./expectNoDBChanges.js`,
  `./getDBChangesDiff.js` and `./getDBSnapshot.js` among the existing modules,
  and no longer exports `./getDBChanges.js`, `./getDBDiffSince.js` or
  `export type * from './internal/DocumentChangeSnapshot.js'`. The
  changes-object types stay as internal types in
  `internal/DocumentChangeSnapshot.ts`, unchanged.
- The repo's emulator tests (`firestore/internal/createRunBatch.emulator.test.ts`,
  `createRunTransaction.emulator.test.ts`) move to
  `expect(await getDBChangesDiff(beforeSnapshot)).toMatchInlineSnapshot(...)`
  with their inline snapshots unchanged (03_02). The admin README moves to the
  two calls (03_04).

### Masked fields leave the timestamp numbering (task 03_03)

Today `internal/getDBChanges.ts` collects every Timestamp in every document,
masked fields included, numbers them, normalizes, and only then masks. A masked
timestamp therefore takes an index and shifts every later timestamp's number.
03_03 masks first:

1. Sort `before.docs` / `after.docs` in place (unchanged).
2. Take a shallow copy of each document's data (`{ ...doc.data() }`), never the
   object `data()` returned, and mask the copies on raw values: a document on
   both sides with `maskModifiedProps(beforeCopy, afterCopy, collection,
   maskKeys)` (this includes unmodified documents, as today), an after-only
   document with `maskProps`, a before-only document with `maskProps`.
3. Collect timestamps from the masked copies only, sort, and `normalizeData`
   each masked copy. A mask token is a string, so a masked Timestamp (or a
   Timestamp nested in a masked Map or Array) never reaches the numbering, and
   `normalizeData` never meets a Timestamp missing from the sorted list.
4. Classify added / modified / unmodified / removed and build the
   `DocumentChangeSnapshot`s from the normalized copies, as today.

- `maskModifiedProps` decides "changed" with `isDeepStrictEqual` on raw values
  now. A Firestore `Timestamp` keeps `_seconds` / `_nanoseconds` as own
  enumerable fields, so two Timestamps compare equal exactly when their instants
  match (checked against the installed `@google-cloud/firestore`); Buffers
  compare by content. That is the same answer the normalized comparison gave.
- `internal/maskProps.ts` `getTypeName` returns `Timestamp` for a raw
  `Timestamp` (`instanceof Timestamp` from `firebase-admin/firestore`), so a
  masked Timestamp prints `/Timestamp/` (labeled `/Timestamp (before)/` /
  `/Timestamp (after)/` when changed) instead of today's `/String/` and
  instead of the `/Map/` a raw object would otherwise get (owner decision). A
  raw Buffer returns `String`, because it used to be masked after
  normalization turned it into `/Buffer .../`, so its token stays as today. A
  raw `DocumentReference` or `GeoPoint` is an object and still gets `/Map/`, as
  its normalized form did.
- Output change: in a diff with a masked timestamp field, every unmasked
  timestamp's index can drop, and the masked field's token reads `Timestamp`
  instead of `String`. Nothing else in the output changes.
- `internal/DocumentChangeSnapshot.ts` is unchanged, including the
  subcollection path hash (`getNormalizedIDForPath`), which numbers a parent
  document's own timestamps without masks, as before.

### Optional `taskName` (task 01_04)

- `tasks/types.ts`: `taskName?: string` with `@deprecated` naming `data.action`
  as the replacement and the fallback order.
- `tasks/createTaskEnqueuer.ts`: compute
  `label = taskName ?? actionOf(data) ?? 'unnamed'` once, where `actionOf` reads
  `(data as { action?: unknown }).action` and returns it only when it is a
  string. Both `logger.info` lines use `label`. `TData extends object` does not
  change.
- `@typescript-eslint/no-deprecated` (on via `strictTypeChecked`) flags every
  read of `taskName`. `taskName` leaves the parameter destructure; the
  parameter is `options`, and `options.taskName` is read once, in the `label`
  line, under a single `// eslint-disable-next-line @typescript-eslint/no-deprecated`
  with a reason comment. `@deprecated` stays; no config change.

### README `server.deps.inline` gaps (task 01_05)

Docs only, in `packages/firebase-kit-admin/README.md` (new short subsection in
`firebase-kit-admin/mocks` with a `vitest.config.ts` block inlining
`firebase-kit-admin` and setting `root` to `src`, as the client's block does,
because the admin README's shims live under `src/__mocks__`; explaining that a bare `vi.mock('firebase-admin/…')` or
`vi.mock('firebase-functions')` only reaches imports made inside the kit when
vitest stops externalizing it) and `packages/firebase-kit-client/README.md`
(the prose around `:111-137` names the `firebase/functions` and `firebase/app`
mocks alongside `getsetdel` as reasons for inlining `firebase-kit-client`).

### What is removed

`EnqueueTaskOptions.taskName` is removed in this release (amendment 02_01),
along with its `@deprecated` JSDoc, the lint exception, its tests and every
README mention. The release is breaking: the squashed commit carries a
`BREAKING CHANGE:` footer naming the removal (major on all three packages).

`testing/internal/snapshotInputs.ts` (the `WeakMap` side table 01_03 added) and
`getDBDiffSince`'s "needs the array getDBSnapshot returned" error are removed in
this release (amendment 03_01, task 03_01), and `getDBSnapshot` stops returning
a bare array. The same `BREAKING CHANGE:` footer names it.

Amendment 03_02 (task 03_02) removes from `firebase-kit-admin/testing`: the
`getDBChanges` export (the function moves to `testing/internal/getDBChanges.ts`),
the old `getDBChangesDiff(changes)` signature (the renderer moves to
`testing/internal/formatDBChanges.ts`; the public name now takes a before
snapshot), the never-released `getDBDiffSince` name, and the line
`export type * from './internal/DocumentChangeSnapshot.js'`, which drops
`DBSnapshotChanges`, `AddedDocumentSnapshot`, `RemovedDocumentSnapshot`,
`ModifiedDocumentSnapshot` and `UnmodifiedDocumentSnapshot` from the public
types. No public call returns or takes those types any more, so they are not
kept as type-only exports. The same `BREAKING CHANGE:` footer names it.

## Hard-to-undo

- Public API additions in a published package: `getDocumentsFromQuery` and
  `getDocuments` (`firebase-kit-admin/firestore`), `expectNoDBChanges` and the
  `DBSnapshot` type (`firebase-kit-admin/testing`). No `exports` subpath is
  added or removed. `getDBDiffSince` is built on this branch and renamed before
  release, so it never ships.
- `EnqueueTaskOptions.taskName`: see the 02_01 removal below (the earlier
  optional/`@deprecated` step never ships).
- Default diff output changes for every modified document with a masked field
  whose value changed: the field prints a `(before)` / `(after)` token pair.
  That includes masked timestamp-like fields, which count as changed every time
  they are rewritten (the admin README's own mask, `{ spaces: ['updated'] }`, is
  that case), and masked fields whose type changed. Every consumer inline
  snapshot covering such a document changes once. This output change alone was
  approved to ship without a footer (owner decision), but the release as a
  whole is breaking, so the squashed commit carries a `BREAKING CHANGE:` footer.
- Amendment 2026-11-13 (02_01): public API removal. `EnqueueTaskOptions.taskName`
  is deleted (superseding the optional/`@deprecated` item above); a caller that
  still passes it no longer compiles. The squashed commit must carry a
  `BREAKING CHANGE:` footer naming the removal, which bumps the major on all
  three packages (they version together).
- Amendment 2026-11-13 (03_01): public API change in `firebase-kit-admin/testing`.
  `getDBSnapshot` returns a `DBSnapshot` object (`{ docs, refs }`) instead of
  `QueryDocumentSnapshot[]`. A consumer test that iterates a snapshot, reads
  `.length` or asserts `toEqual([])` on it no longer compiles and must read
  `.docs`. The same squashed `BREAKING CHANGE:` footer must name it.
- Amendment 2026-11-13 (03_02): public API removal and signature change in
  `firebase-kit-admin/testing`. `getDBChanges` is no longer exported.
  `getDBChangesDiff` keeps its name but takes `(before: DBSnapshot, masks?)`
  and returns `Promise<string>` instead of taking a changes object and
  returning `string`, so every consumer call `getDBChangesDiff(getDBChanges(before,
  after))` stops compiling and becomes `await getDBChangesDiff(before)`. The
  types `DBSnapshotChanges`, `AddedDocumentSnapshot`, `RemovedDocumentSnapshot`,
  `ModifiedDocumentSnapshot` and `UnmodifiedDocumentSnapshot` are no longer
  exported (decision: dropped outright, because nothing public produces them).
  Putting any of these back later is additive, but removing them is a major.
  The same squashed `BREAKING CHANGE:` footer must name it.
- Amendment 2026-11-13 (03_02, task 03_03): default diff output change. Masked
  fields no longer take part in the `/Timestamp NNNN/` numbering, so in every
  consumer inline snapshot whose masks cover a timestamp field, the indexes of
  the other timestamps can drop and the snapshot changes once.
- Amendment 2026-11-13 (03_02 owner addition, task 03_03): default diff output
  change. The printed token for a masked top-level Timestamp field changes from
  `/String/` to `/Timestamp/` (and `/String (before)/` / `/String (after)/` to
  `/Timestamp (before)/` / `/Timestamp (after)/`), so every consumer inline
  snapshot that masks a timestamp field changes once. A Timestamp nested in a
  masked Map or Array is still covered by `/Map/` / `/Array/`. Other mask tokens
  do not change.
- No new dependency, no data writes or deletes, schema or migrations, money, or
  repo-wide commands.

## Task index

| Task file | What it does | Files |
| --- | --- | --- |
| `01_01_firestore_read_helpers.md` | Adds `getDocumentsFromQuery` and `getDocuments` with emulator tests and README docs | `src/firestore/getDocumentsFromQuery.ts`, `src/firestore/getDocuments.ts`, `src/firestore/index.ts`, `README.md` (admin) |
| `01_02_mask_after_comparison.md` | Shows a changed masked value as a `(before)` / `(after)` token pair | `src/testing/internal/maskProps.ts`, `src/testing/internal/maskModifiedProps.ts`, `src/testing/getDBChanges.ts`, `README.md` (admin) |
| `01_03_db_diff_since.md` | Adds `getDBDiffSince` backed by a WeakMap of snapshot inputs (replaced by 03_01, renamed by 03_02) | `src/testing/internal/snapshotInputs.ts`, `src/testing/getDBSnapshot.ts`, `src/testing/getDBDiffSince.ts`, `src/testing/index.ts`, `README.md` (admin) |
| `01_04_optional_task_name.md` | Makes `taskName` optional and derives the log label from `data.action` | `src/tasks/types.ts`, `src/tasks/createTaskEnqueuer.ts`, `README.md` (admin) |
| `01_05_inline_docs.md` | Documents the `server.deps.inline` requirement in both READMEs | `packages/firebase-kit-admin/README.md`, `packages/firebase-kit-client/README.md` |
| `02_01_remove_task_name.md` | Removes `taskName` from `EnqueueTaskOptions`; labels task logs from `data.action`, else `unnamed` (breaking) | `src/tasks/types.ts`, `src/tasks/createTaskEnqueuer.ts`, `README.md` (admin) |
| `03_01_snapshot_object.md` | `getDBSnapshot` returns an exported `DBSnapshot` `{ docs, refs }`; `getDBChanges` / `getDBDiffSince` take it; deletes the WeakMap side table (breaking) | `src/testing/getDBSnapshot.ts`, `src/testing/getDBChanges.ts`, `src/testing/getDBDiffSince.ts`, `src/testing/internal/snapshotInputs.ts` (delete) |
| `03_02_two_call_diff_api.md` | Makes `getDBChanges` and the changes renderer internal, renames `getDBDiffSince` to `getDBChangesDiff`, adds `expectNoDBChanges`, drops the changes-object type exports, moves the emulator tests (breaking) | `src/testing/internal/getDBChanges.ts` (moved), `src/testing/internal/formatDBChanges.ts` (moved), `src/testing/getDBChangesDiff.ts` (replaced), `src/testing/expectNoDBChanges.ts` (new), `src/testing/index.ts` |
| `03_03_masked_timestamp_numbering.md` | Masks before normalizing so masked fields leave the `/Timestamp NNNN/` numbering; a masked Timestamp prints `/Timestamp/` instead of `/String/` | `src/testing/internal/getDBChanges.ts`, `src/testing/internal/maskProps.ts`, `src/testing/internal/maskModifiedProps.ts` |
| `03_04_readme_two_call_api.md` | Moves the admin README's testing section and API reference to `getDBChangesDiff(before)` / `expectNoDBChanges(before)` and `DBSnapshot` | `packages/firebase-kit-admin/README.md` |

## Amendments

- 2026-11-13 `taskName` is removed from `EnqueueTaskOptions` outright instead of being kept optional and `@deprecated`: the log label is `data.action`, else `unnamed`; the lint exception, the `@deprecated` JSDoc, the `taskName` tests and every README mention of `taskName` go. The release becomes a breaking change: the squashed commit must carry a `BREAKING CHANGE:` footer naming the removal (a caller that still passes `taskName` no longer compiles), which bumps the major on all three packages. This supersedes the "Task 5" and "Release — one regular feature" decisions in goals.md and the 01_04 design above — the owner asked for it at review — tasks: 02_01
- 2026-11-13 `getDBSnapshot` returns an object holding the documents and the refs it was taken from (`{ docs, refs }` or similar) instead of a bare array; `getDBChanges` and `getDBDiffSince` take that object, and `getDBDiffSince(before, masks?)` reads the refs from it. The hidden module-level `WeakMap` (`src/testing/internal/snapshotInputs.ts`) and the "unregistered snapshot" error are deleted, and the snapshot type is exported. Plain arrays are no longer accepted. This is a second breaking change for the same `BREAKING CHANGE:` footer: a test that treats a snapshot as an array (iteration, `.length`, `toEqual([])`) must read `.docs`; a test that only passes snapshots to `getDBChanges` is unaffected. Supersedes the "Task 3 — the snapshot remembers its refs" decision in goals.md and the 01_03 design above — the owner objected at review to module-level state in the package — tasks: 03_01 (The clause "a test that only passes snapshots to `getDBChanges` is unaffected" is superseded by the next amendment, which takes `getDBChanges` out of the public API.)
- 2026-11-13 The testing diff API becomes two public calls on a before snapshot, and the before-and-after API is removed. (1) `getDBChanges(before, after, masks?)` and the old `getDBChangesDiff(changes)` stop being exported and become internal. (2) The call built as `getDBDiffSince(before, masks?)` is renamed `getDBChangesDiff(before, masks?)`: it re-reads the refs carried by the snapshot object and returns the printed diff. (3) New `expectNoDBChanges(before)`: re-reads the same refs and fails, with the printed diff in the message, if any document was added, removed or modified; it takes no masks. (4) Masked fields are left out of the `/Timestamp NNNN/` numbering, so masking a timestamp no longer shifts the index of every other timestamp; a masked Timestamp still prints its mask token, with `(before)` / `(after)` labels when its value changed. All of this joins the same `BREAKING CHANGE:` footer. Basis: a survey of the consuming app found 661 diff sites and 411 no-change assertions that all fit this shape, no test that inspects the changes object beyond what (3) and the `(before)` / `(after)` labels cover, and about 21 sites that strip timestamps from snapshots only because of the numbering behaviour (4) fixes. The owner decided this at review, and chose the names for symmetry — tasks: 03_01 revised, 03_02, 03_03, 03_04. Owner addition to (4): a masked Firestore Timestamp prints its class name, `"/Timestamp/"` (`"/Timestamp (before)/"` / `"/Timestamp (after)/"` when its value changed), not `"/String/"` and not `"/Map/"` — task 03_03
- 2026-11-13 Task data must carry its action: `createTaskEnqueuer`'s enqueue function is typed `<TData extends { action: string }>` (and `EnqueueTaskOptions` to match), the log label is `data.action` directly, and `getAction`, its cast through `unknown` and the `unnamed` fallback are deleted. Task data without a string `action` no longer compiles, which joins the same `BREAKING CHANGE:` footer. Supersedes the `data.action`, else `unnamed` label rule of the first amendment — the owner chose this in a review note asking for better types than `object` and `unknown` — tasks: 04_01
