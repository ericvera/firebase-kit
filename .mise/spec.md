# Spec: backlog helpers for firebase-kit-admin

## What

Five changes to `packages/firebase-kit-admin` plus two README fixes, released as
one `feat:` commit with no `BREAKING CHANGE:` footer.

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
   plain statement between `getDBSnapshot` and this call.
4. **Masked values compared before masking** (default, no switch): a masked
   field whose value changed prints as a `-` / `+` pair of lines that both show
   the mask token, and a document whose only change is a masked field no longer
   prints an empty body. Output for every other case is byte-identical to today.
5. **`taskName` optional** in `EnqueueTaskOptions`, marked `@deprecated`. The
   log label is `taskName` when passed, else `data.action` when it is a string,
   else `unnamed`.
6. **README gaps on `server.deps.inline`**: the admin README states the
   requirement its mocks depend on; the client README gives the full set of
   reasons (its `firebase/functions` and `firebase/app` mocks, not only the
   IndexedDB fake). `firebase-kit-protocol` is not listed. Nothing is built for
   the spike.

Out of scope: removing `taskName`; consumer call-site updates; any vitest preset
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

### Masking after comparison (task 01_02)

Today `getDBChanges` masks each side (`internal/maskProps.ts`, in place) before
the comparison, so a masked field whose raw value changed but whose type token
did not is invisible. The fix keeps masking where it is but records, for a
modified document, which masked keys really changed, and lets the diff compare
one rendering and display another.

- New internal `testing/internal/getChangedMaskedKeys.ts`:
  `getChangedMaskedKeys(before: unknown, after: unknown, collection: string,
  maskKeys: Record<string, string[]>): string[]`. Returns the collection's
  masked keys that are present (not `undefined`) on both sides and whose
  normalized values differ by `isDeepStrictEqual` from `node:util`. A key present
  on only one side is excluded, because it already prints as `+` or `-`.
- `getDBChanges.ts`: in the added/modified loop, look up the before entry and
  call `getChangedMaskedKeys` on the two normalized (unmasked) values before
  either `maskProps` call runs (both mutate). Pass the result as a new last
  constructor argument `changedMaskedKeys: string[] = []` of
  `ModifiedDocumentSnapshot`. Added, removed and unmodified paths are unchanged.
- `internal/DocumentChangeSnapshot.ts` `ModifiedDocumentSnapshot.getDiff()`:
  with no changed masked keys, it calls the existing `getDiff` (output
  unchanged). Otherwise it builds compare copies of both masked objects in which
  each changed key's value is made distinct (before gets `<token>\u0000before`,
  after gets `<token>\u0000after`; tokens are always one-line strings), formats
  display data with pretty-format's `format(value)` and compare data with
  `format(value, { indent: 0 })`, splits each on `\n`, and calls jest-diff's
  `diffLinesUnified2(aDisplay, bDisplay, aCompare, bCompare, options)` with the
  same options object `getDiff` passes today. That is exactly what jest-diff's
  own `compareObjects` does (`node_modules/jest-diff/build/index.js:1543-1555`),
  except the compare lines differ from the display lines only on the changed
  masked keys.
- New runtime dependency: `pretty-format` (`^30.5.1`, the version jest-diff
  30.5.2 pins) in `firebase-kit-admin` `dependencies`, because jest-diff does not
  re-export `format`. Run `yarn install` to update `yarn.lock`.
- `maskProps` itself does not change.

Worked output (masked `secret`, `name` also changed):

```
  Object {
-   "name": "Draft",
-   "secret": "/String/",
+   "name": "Final",
+   "secret": "/String/",
  }
```

### `getDBDiffSince` (task 01_03)

- New internal `testing/internal/snapshotInputs.ts`: a module-level
  `WeakMap<QueryDocumentSnapshot[], SnapshotInput[]>` with
  `registerSnapshotInputs(docs, inputs)` and
  `getSnapshotInputs(docs): SnapshotInput[] | undefined`.
- `getDBSnapshot.ts`: registers the returned array against its normalized input
  array before returning it. Signature, return type and exported types are
  unchanged. A WeakMap entry is invisible to iteration, spread, JSON and
  `toEqual`, and survives `getDBChanges`' in-place sort.
- New `testing/getDBDiffSince.ts`:

  ```ts
  export const getDBDiffSince = async <TCollection extends string = string>(
    before: QueryDocumentSnapshot[],
    masks?: Partial<Record<TCollection, string[]>>,
  ): Promise<string>
  ```

  Looks up `before`'s inputs; if none, throws
  `Error('getDBDiffSince needs the array getDBSnapshot returned; a copy made with slice, spread or filter does not carry the refs it was taken from')`.
  Otherwise `getDBSnapshot(inputs)` → `getDBChanges(before, after, masks)` →
  `getDBChangesDiff(changes)`.
- Exported from `testing/index.ts`. `getDBSnapshot`, `getDBChanges` and
  `getDBChangesDiff` stay exported and unchanged. The README example at
  `README.md:527-550` moves to the new call. Existing repo emulator tests keep
  the three-step form.

### Optional `taskName` (task 01_04)

- `tasks/types.ts`: `taskName?: string` with `@deprecated` naming `data.action`
  as the replacement and the fallback order.
- `tasks/createTaskEnqueuer.ts`: compute
  `label = taskName ?? actionOf(data) ?? 'unnamed'` once, where `actionOf` reads
  `(data as { action?: unknown }).action` and returns it only when it is a
  string. Both `logger.info` lines use `label`. `TData extends object` does not
  change.

### README `server.deps.inline` gaps (task 01_05)

Docs only, in `packages/firebase-kit-admin/README.md` (new short subsection in
`firebase-kit-admin/mocks` with a `vitest.config.ts` block inlining
`firebase-kit-admin`, explaining that a bare `vi.mock('firebase-admin/…')` or
`vi.mock('firebase-functions')` only reaches imports made inside the kit when
vitest stops externalizing it) and `packages/firebase-kit-client/README.md`
(the prose around `:111-137` names the `firebase/functions` and `firebase/app`
mocks alongside `getsetdel` as reasons for inlining `firebase-kit-client`).

### What is removed

Nothing. `taskName` removal is a later breaking release.

## Hard-to-undo

- Public API additions in a published package: `getDocumentsFromQuery` and
  `getDocuments` (`firebase-kit-admin/firestore`), `getDBDiffSince`
  (`firebase-kit-admin/testing`). No `exports` subpath is added or removed.
- Public type change: `EnqueueTaskOptions.taskName` becomes optional and
  `@deprecated` (additive).
- Default output of `getDBChangesDiff` / `ModifiedDocumentSnapshot.getDiff()`
  changes for a modified document with a changed masked field; consumer inline
  snapshots covering such an overwrite change once. Shipped as a regular
  feature, no `BREAKING CHANGE:` footer (owner decision).
- New runtime dependency `pretty-format` in the published `firebase-kit-admin`
  (`dependencies`, plus `yarn.lock`).
- No data writes or deletes, schema or migrations, money, or repo-wide
  commands.

## Task index

| Task file | What it does | Files |
| --- | --- | --- |
| `01_01_firestore_read_helpers.md` | Adds `getDocumentsFromQuery` and `getDocuments` with emulator tests and README docs | `src/firestore/getDocumentsFromQuery.ts`, `src/firestore/getDocuments.ts`, `src/firestore/index.ts`, `README.md` (admin) |
| `01_02_mask_after_comparison.md` | Shows a changed masked value as a `-` / `+` token pair | `src/testing/internal/getChangedMaskedKeys.ts`, `src/testing/getDBChanges.ts`, `src/testing/internal/DocumentChangeSnapshot.ts`, `package.json` (admin, + `yarn.lock`), `README.md` (admin) |
| `01_03_db_diff_since.md` | Adds `getDBDiffSince` backed by a WeakMap of snapshot inputs | `src/testing/internal/snapshotInputs.ts`, `src/testing/getDBSnapshot.ts`, `src/testing/getDBDiffSince.ts`, `src/testing/index.ts`, `README.md` (admin) |
| `01_04_optional_task_name.md` | Makes `taskName` optional and derives the log label from `data.action` | `src/tasks/types.ts`, `src/tasks/createTaskEnqueuer.ts`, `README.md` (admin) |
| `01_05_inline_docs.md` | Documents the `server.deps.inline` requirement in both READMEs | `packages/firebase-kit-admin/README.md`, `packages/firebase-kit-client/README.md` |
