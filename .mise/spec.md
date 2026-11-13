# Spec: backlog helpers for firebase-kit-admin

## What

Five changes to `packages/firebase-kit-admin` plus two README fixes, released as
one commit carrying a `BREAKING CHANGE:` footer that names the removal of
`EnqueueTaskOptions.taskName` (amendment 02_01) and the change of
`getDBSnapshot`'s return value from an array to a `DBSnapshot` object
(amendment 03_01), which bumps the major on all three packages.

1. **`getDocumentsFromQuery(query, reader?)`** (`firebase-kit-admin/firestore`):
   runs a query, through the `TransactionReader` when one is given, and returns
   every match as a typed `{ id, ...data }` entity. Replaces the
   `snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))` callers repeat.
2. **`getDocuments(refs, reader?)`** (`firebase-kit-admin/firestore`): batched
   read of many refs that keeps the refs' document type (Firestore's
   instance-level `getAll` loses it). Returns one entry per ref, in order: the
   `{ id, ...data }` entity, or `undefined` for a missing document. It never
   skips or throws for a missing document.
3. **`getDBDiffSince(before, masks?)`** (`firebase-kit-admin/testing`): takes the
   after snapshot itself from the refs the `before` snapshot was taken from,
   then returns the printable `DB DIFF` string. Replaces the
   after/changes/diff lines of every emulator test; the code under test stays a
   plain statement between `getDBSnapshot` and this call. `getDBSnapshot`
   returns an exported `DBSnapshot` object, `{ docs, refs }`, holding the
   documents and the inputs they were read from; `getDBChanges` and
   `getDBDiffSince` take that object, and plain arrays are no longer accepted
   (amendment 03_01). There is no module-level state.
4. **Changed masked fields get labeled tokens** (default, no switch): in a
   modified document, a masked field whose value changed prints
   `"/String (before)/"` on the before side and `"/String (after)/"` on the after
   side (likewise for every other type token), so jest-diff shows the `-` / `+`
   pair. A masked field that did not change, and every masked field of an added
   or removed document, keeps the plain token. A document whose only change is a
   masked field no longer prints an empty body. No special case for timestamps:
   a masked Timestamp that was rewritten counts as changed.
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
  are unchanged.
- `internal/DocumentChangeSnapshot.ts` does not change: with distinct tokens,
  its existing jest-diff call prints the pair like any other change.
- The label depends only on whether the value changed, so output is stable
  across runs. A masked Timestamp is the string `/Timestamp NNNN/` when masked,
  so it gets `/String/`, and a rewritten one `/String (before)/` /
  `/String (after)/`; there is no timestamp special case. A masked field whose
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

### `getDBDiffSince` (task 01_03, reshaped by amendment 03_01)

01_03 shipped this with a module-level `WeakMap` side table
(`testing/internal/snapshotInputs.ts`) keyed by the array `getDBSnapshot`
returned. Amendment 03_01 replaces that: the snapshot is a plain object that
carries its refs, and the side table and its error are deleted.

- `getDBSnapshot.ts` exports:

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
  the normalized input array (a single input wrapped in an array).
- `getDBChanges.ts`: `getDBChanges(before: DBSnapshot, after: DBSnapshot,
  masks?)`. It reads `before.docs` / `after.docs` where it read the arrays
  before; the in-place sort of those `docs` arrays, the masking and every
  `DocumentChangeSnapshot` constructor call (passed `after.docs` /
  `before.docs`) are unchanged. `refs` is ignored.
- `getDBDiffSince.ts`:

  ```ts
  export const getDBDiffSince = async <TCollection extends string = string>(
    before: DBSnapshot,
    masks?: Partial<Record<TCollection, string[]>>,
  ): Promise<string>
  ```

  `getDBSnapshot(before.refs)` → `getDBChanges(before, after, masks)` →
  `getDBChangesDiff(changes)`. It never throws for a missing record; any
  `{ docs, refs }` value works.
- `testing/internal/snapshotInputs.ts` is deleted. `DBSnapshot` reaches
  `firebase-kit-admin/testing` through the existing
  `export * from './getDBSnapshot.js'` in `testing/index.ts`.
- `getDBChangesDiff` is unchanged. The README example's code is unchanged (it
  only passes the snapshot along); its prose and the API reference describe
  `DBSnapshot`. Existing repo emulator tests keep the three-step form and need
  no change, since they only pass snapshots to `getDBChanges`.

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
this release (amendment 03_01), and `getDBSnapshot` / `getDBChanges` stop
returning / accepting bare arrays. The same `BREAKING CHANGE:` footer names it.

## Hard-to-undo

- Public API additions in a published package: `getDocumentsFromQuery` and
  `getDocuments` (`firebase-kit-admin/firestore`), `getDBDiffSince` and the
  `DBSnapshot` type (`firebase-kit-admin/testing`). No `exports` subpath is
  added or removed.
- `EnqueueTaskOptions.taskName`: see the 02_01 removal below (the earlier
  optional/`@deprecated` step never ships).
- Default output of `getDBChanges` / `getDBChangesDiff` /
  `ModifiedDocumentSnapshot.getDiff()` changes for every modified document with
  a masked field whose value changed: the field prints a `(before)` / `(after)`
  token pair. That includes masked timestamp-like fields, which count as changed
  every time they are rewritten (the admin README's own mask,
  `{ spaces: ['updated'] }`, is that case), and masked fields whose type
  changed. Every consumer inline snapshot covering such a document changes once.
  This output change alone was approved to ship without a footer (owner
  decision), but the release as a whole is breaking because of the
  `taskName` removal below, so the squashed commit carries a
  `BREAKING CHANGE:` footer.
- Amendment 2026-11-13 (02_01): public API removal. `EnqueueTaskOptions.taskName`
  is deleted (superseding the optional/`@deprecated` item above); a caller that
  still passes it no longer compiles. The squashed commit must carry a
  `BREAKING CHANGE:` footer naming the removal, which bumps the major on all
  three packages (they version together).
- Amendment 2026-11-13 (03_01): public API change in `firebase-kit-admin/testing`.
  `getDBSnapshot` returns a `DBSnapshot` object (`{ docs, refs }`) instead of
  `QueryDocumentSnapshot[]`; `getDBChanges` and `getDBDiffSince` accept only
  that object, not plain arrays. A consumer test that iterates a snapshot, reads
  `.length`, asserts `toEqual([])` on it, or passes a hand-built array to
  `getDBChanges` no longer compiles and must use `.docs` / build a
  `{ docs, refs }`; a test that only passes snapshots from `getDBSnapshot` to
  `getDBChanges` is unaffected. The same squashed `BREAKING CHANGE:` footer
  must name this second change.
- No new dependency, no data writes or deletes, schema or migrations, money, or
  repo-wide commands.

## Task index

| Task file | What it does | Files |
| --- | --- | --- |
| `01_01_firestore_read_helpers.md` | Adds `getDocumentsFromQuery` and `getDocuments` with emulator tests and README docs | `src/firestore/getDocumentsFromQuery.ts`, `src/firestore/getDocuments.ts`, `src/firestore/index.ts`, `README.md` (admin) |
| `01_02_mask_after_comparison.md` | Shows a changed masked value as a `(before)` / `(after)` token pair | `src/testing/internal/maskProps.ts`, `src/testing/internal/maskModifiedProps.ts`, `src/testing/getDBChanges.ts`, `README.md` (admin) |
| `01_03_db_diff_since.md` | Adds `getDBDiffSince` backed by a WeakMap of snapshot inputs (replaced by 03_01) | `src/testing/internal/snapshotInputs.ts`, `src/testing/getDBSnapshot.ts`, `src/testing/getDBDiffSince.ts`, `src/testing/index.ts`, `README.md` (admin) |
| `01_04_optional_task_name.md` | Makes `taskName` optional and derives the log label from `data.action` | `src/tasks/types.ts`, `src/tasks/createTaskEnqueuer.ts`, `README.md` (admin) |
| `01_05_inline_docs.md` | Documents the `server.deps.inline` requirement in both READMEs | `packages/firebase-kit-admin/README.md`, `packages/firebase-kit-client/README.md` |
| `02_01_remove_task_name.md` | Removes `taskName` from `EnqueueTaskOptions`; labels task logs from `data.action`, else `unnamed` (breaking) | `src/tasks/types.ts`, `src/tasks/createTaskEnqueuer.ts`, `README.md` (admin) |
| `03_01_snapshot_object.md` | `getDBSnapshot` returns an exported `DBSnapshot` `{ docs, refs }`; `getDBChanges` / `getDBDiffSince` take it; deletes the WeakMap side table (breaking) | `src/testing/getDBSnapshot.ts`, `src/testing/getDBChanges.ts`, `src/testing/getDBDiffSince.ts`, `src/testing/internal/snapshotInputs.ts` (delete), `README.md` (admin) |

## Amendments

- 2026-11-13 `taskName` is removed from `EnqueueTaskOptions` outright instead of being kept optional and `@deprecated`: the log label is `data.action`, else `unnamed`; the lint exception, the `@deprecated` JSDoc, the `taskName` tests and every README mention of `taskName` go. The release becomes a breaking change: the squashed commit must carry a `BREAKING CHANGE:` footer naming the removal (a caller that still passes `taskName` no longer compiles), which bumps the major on all three packages. This supersedes the "Task 5" and "Release — one regular feature" decisions in goals.md and the 01_04 design above — the owner asked for it at review — tasks: 02_01
- 2026-11-13 `getDBSnapshot` returns an object holding the documents and the refs it was taken from (`{ docs, refs }` or similar) instead of a bare array; `getDBChanges` and `getDBDiffSince` take that object, and `getDBDiffSince(before, masks?)` reads the refs from it. The hidden module-level `WeakMap` (`src/testing/internal/snapshotInputs.ts`) and the "unregistered snapshot" error are deleted, and the snapshot type is exported. Plain arrays are no longer accepted. This is a second breaking change for the same `BREAKING CHANGE:` footer: a test that treats a snapshot as an array (iteration, `.length`, `toEqual([])`) must read `.docs`; a test that only passes snapshots to `getDBChanges` is unaffected. Supersedes the "Task 3 — the snapshot remembers its refs" decision in goals.md and the 01_03 design above — the owner objected at review to module-level state in the package — tasks: 03_01
