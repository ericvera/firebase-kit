# Spec: nested, type-checked mask paths for `getDBChangesDiff`

## What

`getDBChangesDiff(before, masks)` in `firebase-kit-admin/testing` masks values that are not stable enough to assert on. Today a mask entry only matches a top-level field. After this change:

- A mask entry is a Firestore `update()`-style field path. It is always split on `.`, so `'quote.fees.topUpRetryStartedAt'` masks that one nested value and leaves its siblings visible.
- A nested masked value gets exactly the treatment a top-level one gets today: a type token (`/Timestamp/`, `/String/`, ...), `(before)`/`(after)` labels only when the value is present on both sides of a modified document and changed, a plain token when present on one side only, and it stays out of the `/Timestamp NNNN/` numbering.
- A path walks plain maps only. It never enters array elements, Timestamps or other Firestore value classes. An array, or a whole map, is masked as one value. A path whose intermediate value is missing or is not a map is skipped silently, as a missing top-level field is today.
- Masking never mutates the caller's documents, nested maps included.
- Every mask entry is type checked against its collection's document type with Firestore's own `UpdateData<T>`, so a mistyped path fails to compile. Document types come from a schema type argument on each call: `getDBChangesDiff<DBSchema>(before, { orders: ['quote.fees.topUpRetryStartedAt'] })`, where `DBSchema` maps each collection name to its document type.
- Passing masks without a schema type argument does not compile. Calling without masks still needs no type argument.
- Ships as a major (owner decision). Task 01_02's commit carries a `BREAKING CHANGE:` footer naming the three breaks. The repository squashes with `COMMIT_MESSAGES`, so that footer lands in the default squash message, and the pull request description repeats it verbatim so a hand-edited squash message keeps it (see `## Hard-to-undo`).

Out of scope: `FieldPath` entries, masks on `expectNoDBChanges`, the okven helper replacement.

## Design

### Runtime (task 01_01)

New module `packages/firebase-kit-admin/src/testing/internal/maskPath.ts`:

- `isMap(value: unknown): value is Record<string, unknown>` is true only for a plain object (prototype `Object.prototype` or `null`). Timestamps, Buffers, GeoPoints, DocumentReferences and arrays are not maps. This is what a path may walk through.
- `readPath(data: Record<string, unknown>, path: string): unknown` splits `path` on `.` and walks maps. It returns `undefined` when any intermediate is missing or not a map.
- `writePath(data: Record<string, unknown>, path: string, value: unknown): void` writes the leaf. On the way down it replaces each intermediate map with a shallow copy (`parent[seg] = { ...child }`) before descending, so the caller's nested objects are never written. It is only called after `readPath` returned a defined value, so every intermediate is a map.

`maskProps` and `maskModifiedProps` keep their signatures (`maskKeys: Record<string, string[]>`), their in-place mutation of the top-level object they are handed, and every token rule. They replace `obj[key]` reads and writes with `readPath`/`writePath`. `maskModifiedProps` keeps its fallback to `maskProps` when either side is not a plain object, and uses `isMap` from `maskPath.ts` for that check. The "only works with props that exist in the top level" note in `maskProps.ts` is removed.

`getDBChanges` keeps its top-level `{ ...doc.data() }` copy. Nested copies happen inside `writePath`, only along masked paths. Masking still runs before timestamp collection, so a masked nested Timestamp takes no index.

Behavior change in 01_01: a mask string containing `.` now addresses a nested field instead of a literal top-level field with a dot in its name. That is the intended breaking change.

### Types (task 01_02)

`packages/firebase-kit-admin/src/testing/getDBChangesDiff.ts` exports:

```ts
export type DBMasks<TSchema> = {
  [C in keyof TSchema & string]?: readonly (keyof UpdateData<TSchema[C]> & string)[]
}

export const getDBChangesDiff = async <
  TSchema extends { [C in keyof TSchema]: DocumentData } = never,
>(
  before: DBSnapshot,
  masks?: NoInfer<[TSchema] extends [never] ? undefined : DBMasks<TSchema>>,
): Promise<string>
```

`UpdateData` and `DocumentData` are imported as types from `firebase-admin/firestore`. The constraint `{ [C in keyof TSchema]: DocumentData }` (rather than `Record<string, DocumentData>`) lets the schema itself be an `interface`. The `never` default plus the `[TSchema] extends [never]` conditional makes masks without a type argument a compile error, and `NoInfer` stops TypeScript from inferring a schema from the masks. This exact shape was type-checked by the planner against the installed firebase-admin: an interface schema, an interface top-level document, dotted nested keys through `| null` maps, whole arrays and a `DBMasks<S>` value assigned to `Partial<Record<string, readonly string[]>>` all compile, while typos, `'items.0.sku'`, unknown collection keys and masks without a schema are rejected.

The internal `getDBChanges` (`internal/getDBChanges.ts`) loses its `TCollection` type parameter. Its `masks` parameter becomes `Partial<Record<string, readonly string[]>>`, and `maskProps`/`maskModifiedProps` widen to `Record<string, readonly string[] | undefined>` (or equivalent) to accept it. Collection keying stays `doc.ref.parent.id`.

Removed in 01_02: the `TCollection` type parameter on `getDBChangesDiff` and on internal `getDBChanges`, and the JSDoc sentence about keying by a collection enum. Callers with `getDBChangesDiff<DBCollection>(...)` stop compiling, which is the breaking change.

A nested map typed as a named interface adds no dotted keys, exactly as with `update()`. The repo lint rule `@typescript-eslint/consistent-type-definitions` (default `interface` option) rejects `type X = {...}` aliases, so documents and schemas are declared as `interface`s with each nested map written as an inline object type literal on its property (`interface Space { meta: { at: Timestamp; keep: string } | null }`), never as a named interface. This package's nested-mask type tests declare local document types that way, and the README gives consumers the same advice. `src/__test__/db/types.ts` is not changed.

### Docs (task 01_02)

`packages/firebase-kit-admin/README.md`: the masks paragraph (`:564-570`) describes dotted `update()`-style paths, the schema type argument, the interface caveat with the advice to declare nested maps as inline object type literals on an interface property rather than as named interfaces, and that a field whose name contains a literal `.` cannot be masked on its own. The `renameSpace.emulator.test.ts` example (`:574-609`) passes a schema type argument. The API line (`:814`) shows `getDBChangesDiff<TSchema>(before, masks?)` and mentions `DBMasks`. No dependency versions restated.

## Hard-to-undo

- Public API change in `firebase-kit-admin/testing`: `getDBChangesDiff`'s type parameter changes from a collection-name union to a schema map, masks without a schema stop compiling, a dotted mask string now addresses a nested field instead of a literal dotted top-level field, and a new exported type `DBMasks` is added. Released as a major, and all three packages take the next major. Task 01_02's commit carries the `BREAKING CHANGE:` footer below (the default squash body joins branch commit messages). Earlier squash commits on main (`cc759b5`, `cf90d38`) have hand-written bodies, so the merger may rewrite the squash message. The pull request description must repeat this footer text verbatim, as its own final paragraph, so whoever writes the squash message keeps it. The footer is a single line, as in earlier majors (`git log -1 --format=%B cc759b5`), because text follows it in the squash body (the `Co-Authored-By:` trailer and later commit messages) and a multi-line footer would pull that text into the release note:

  ```text
  BREAKING CHANGE: getDBChangesDiff in firebase-kit-admin/testing now takes a schema map type argument instead of a collection-name union, masks passed without a schema type argument no longer compile, and a dotted mask string such as 'a.b' now addresses nested field b inside map a instead of a top-level field named 'a.b'.
  ```

  The pull request is opened after the close step has removed `.mise/`, so this spec is gone by then. Whoever writes the pull request description takes the footer verbatim from the body of the `Task 01_02` commit on the branch, found with `git log --grep='^Task 01_02' --format=%B` (or `git log --format=%B` on the branch), not from this file.
- README public documentation of the masks API (`packages/firebase-kit-admin/README.md`) is rewritten.
- Amendment 2026-11-14, public output change in `firebase-kit-admin/testing`: `getDBChangesDiff` (and the `expectNoDBChanges` failure diff) prints a subcollection document's parent as its number among its siblings instead of a content hash, prints that number in the parent collection's own sections, and sorts sections by path before kind. Every consumer's recorded snapshot of that output must be re-recorded. Task 02_05's commit carries a second single-line footer, and the pull request description must repeat it verbatim beside the 01_02 footer, each as its own paragraph. Take both from the branch with `git log --format=%B main..HEAD | grep '^BREAKING CHANGE:'`, not from this file:

  ```text
  BREAKING CHANGE: getDBChangesDiff output now names a subcollection document's parent by its number among its siblings instead of a content hash, prints that number in the parent collection's own sections, and sorts sections by path before kind, so existing getDBChangesDiff and expectNoDBChanges snapshots must be re-recorded.
  ```

- Amendment 2026-11-14: a new README paragraph (`packages/firebase-kit-admin/README.md`, before the masks paragraph) documents numbered parents and path ordering.

## Task index

| Task file | What it does | Files |
| --- | --- | --- |
| `01_01_nested_mask_paths.md` | Mask entries resolve as dotted paths through plain maps, with copy-on-write so caller data is never mutated | `packages/firebase-kit-admin/src/testing/internal/maskPath.ts` (new), `internal/maskProps.ts`, `internal/maskModifiedProps.ts`, `internal/getDBChanges.ts` |
| `01_02_typed_mask_schema.md` | `getDBChangesDiff` takes a schema type argument and types masks with `keyof UpdateData`, internal generic dropped, README rewritten | `packages/firebase-kit-admin/src/testing/getDBChangesDiff.ts`, `internal/getDBChanges.ts`, `internal/maskProps.ts`, `internal/maskModifiedProps.ts`, `packages/firebase-kit-admin/README.md` |
| `02_01_split_mask_path_helpers.md` | Check and commit `isMap`, `readPath`, `writePath` as one file each, beside `maskPath.ts` | `internal/isMap.ts`, `internal/readPath.ts`, `internal/writePath.ts` (all new) |
| `02_02_repoint_mask_callers.md` | Check and commit the mask callers' new imports and the deletion of `maskPath.ts` | `internal/maskProps.ts`, `internal/maskModifiedProps.ts`, `internal/maskPath.ts` (deleted) |
| `02_03_doc_numbering_helpers.md` | Check and commit the pure helpers that number documents among siblings and build path segments | `internal/compareCodeUnits.ts`, `internal/getCollectionPatterns.ts`, `internal/getDocNumbers.ts`, `internal/getParentPatterns.ts`, `internal/getDocPathSegments.ts` (all new) |
| `02_04_number_parents_in_paths.md` | Check and commit numbered parents in diff paths, replacing the content hash | `internal/formatDocPath.ts` (new), `internal/DocumentChangeSnapshot.ts`, `internal/getDBChanges.ts` |
| `02_05_sort_sections_by_path.md` | Check and commit path-before-kind section order, README and JSDoc, with the snapshot re-record `BREAKING CHANGE:` footer | `internal/compareDocPaths.ts` (new), `internal/formatDBChanges.ts`, `packages/firebase-kit-admin/src/testing/getDBChangesDiff.ts`, `packages/firebase-kit-admin/README.md` |

## Amendments

- 2026-11-14 `getDBChangesDiff` output changes. A subcollection document's parent prints as its number among its siblings instead of a content hash, a collection's documents print their number in their own sections when the diff holds documents from one of its subcollections, sections sort by path before kind, and `maskPath.ts` is split into one file per function. The work is already in the working tree, uncommitted, and the task is to check and commit it — the parent hash changed on any edit to the parent and reordered sections, and files in this repo hold one main export — tasks: 02_01, 02_02, 02_03, 02_04, 02_05
