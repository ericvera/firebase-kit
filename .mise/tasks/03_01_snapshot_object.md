# 03_01 The DB snapshot is an object that carries its refs

## Goal

Make `getDBSnapshot` (in `firebase-kit-admin/testing`) return an exported
`DBSnapshot` object, `{ docs, refs }`, holding the documents it read and the
inputs it read them from, instead of a bare `QueryDocumentSnapshot[]`.
`getDBChanges` and `getDBDiffSince` take that object; plain arrays are no longer
accepted. `getDBDiffSince(before, masks?)` reads the refs from `before.refs`.
Delete the module-level `WeakMap` side table
(`src/testing/internal/snapshotInputs.ts`) and the "needs the array
getDBSnapshot returned" error. The owner objected at review to module-level
state in the package. This is a breaking public API change.

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/testing/getDBSnapshot.ts` (modify)
- `src/testing/getDBChanges.ts` (modify)
- `src/testing/getDBDiffSince.ts` (modify)
- `src/testing/internal/snapshotInputs.ts` (delete)
- `README.md` (modify)

Tests and fixtures (they do not count toward the limit):
`src/__test__/utils/createDBSnapshot.ts` (create),
`src/testing/getDBSnapshot.test.ts`, `src/testing/getDBDiffSince.test.ts`,
`src/testing/getDBChanges.test.ts`, `src/testing/getDBChangesDiff.test.ts`.

`src/testing/index.ts` needs no change. It already has
`export * from './getDBSnapshot.js'` (line 8), so the new `DBSnapshot` interface
is exported through it.

## Background

What exists today (task 01_03, already committed):

- `src/testing/getDBSnapshot.ts:26-41`: `getDBSnapshot(inputs: SnapshotInput |
  SnapshotInput[]): Promise<QueryDocumentSnapshot[]>`. It normalizes `inputs`
  to `inputArray` (line 29), resolves each to a query, flattens the results into
  `docs`, calls `registerSnapshotInputs(docs, inputArray)` (line 38) and returns
  `docs`. `TestableDBRef` and `SnapshotInput` are exported at :9-14.
- `src/testing/internal/snapshotInputs.ts`: a module-level
  `WeakMap<QueryDocumentSnapshot[], SnapshotInput[]>` with
  `registerSnapshotInputs` and `getSnapshotInputs`. Only `getDBSnapshot.ts` and
  `getDBDiffSince.ts` import it.
- `src/testing/getDBDiffSince.ts:15-30`: looks up `getSnapshotInputs(before)`,
  throws `Error('getDBDiffSince needs the array getDBSnapshot returned; ...')`
  when there is none, then `getDBSnapshot(inputs)` and
  `getDBChangesDiff(getDBChanges(before, after, masks))`.
- `src/testing/getDBChanges.ts:23-153`: `getDBChanges(beforeDocs, afterDocs,
  masks?)` takes two `QueryDocumentSnapshot[]`. It sorts both arrays in place
  (:60-72), reads them in the added/modified/removed loops (:78, :134), and
  passes `afterDocs` / `beforeDocs` to the `DocumentChangeSnapshot`
  constructors (:90, :120, :125, :146) as the `allDocs` used for path
  normalization (`internal/DocumentChangeSnapshot.ts:80-108`). The JSDoc
  (:15-22) says "Both snapshot arrays are sorted in place."
- Repo callers: `src/firestore/internal/createRunBatch.emulator.test.ts:27,38,63,79`
  and `createRunTransaction.emulator.test.ts:27,42` take snapshots with
  `getDBSnapshot` and pass them only to `getDBChanges`. They need no change.
- Admin `README.md`: the testing prose at about :554-566 says "so `before` must
  be the array `getDBSnapshot` returned, not a copy"; the example code at
  about :567-585 only passes the snapshot to `getDBDiffSince`; the API reference
  at about :794-806 has the `getDBSnapshot(inputs)` and `getDBDiffSince` bullets
  and the exported-types list (`TestableDBRef`, `SnapshotInput`, ...).

Design decisions that reach this task (spec.md "`getDBDiffSince`" and the
2026-11-13 amendment):

- The snapshot type is named `DBSnapshot`, declared and exported in
  `getDBSnapshot.ts`:

  ```ts
  export interface DBSnapshot {
    /** Every document read, flattened across the inputs in order. */
    docs: QueryDocumentSnapshot[]
    /** The inputs the documents were read from, always as an array. */
    refs: SnapshotInput[]
  }
  ```

- `getDBChanges(before: DBSnapshot, after: DBSnapshot, masks?)`. Its behavior
  is unchanged apart from reading `.docs`. It still sorts each snapshot's
  `docs` array in place and ignores `refs`.
- `getDBDiffSince(before: DBSnapshot, masks?)` re-reads `before.refs`. It has
  no error path of its own. Any `{ docs, refs }` value works, including a
  hand-built one.
- There is no module-level state anywhere in the testing module.
- No other signature changes. `getDBChangesDiff` is untouched.

Patterns: test fixtures live in `src/__test__/utils/` (for example
`createDocSnapshot.ts`, a named arrow-function export with a JSDoc).

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `src/testing/getDBSnapshot.ts`
   - Add the `DBSnapshot` interface above (after `SnapshotInput`).
   - Return type is `Promise<DBSnapshot>`. Return `{ docs, refs: inputArray }`.
     Store the normalized `inputArray`, not the raw `inputs`.
   - Remove the `registerSnapshotInputs` import and call.
   - Update the JSDoc: it returns the documents together with the inputs they
     came from, and `getDBDiffSince` re-reads `refs` for the after snapshot.
2. `src/testing/getDBChanges.ts`
   - Parameters become `before: DBSnapshot, after: DBSnapshot, masks?`. Import
     `DBSnapshot` as a type from `./getDBSnapshot.js` (type-only, so there is
     no runtime cycle: `getDBSnapshot.ts` does not import `getDBChanges`).
   - At the top, `const beforeDocs = before.docs` and
     `const afterDocs = after.docs`. The body below stays as it is.
   - JSDoc: "Diffs two `getDBSnapshot` results ..." and "Both snapshots'
     `docs` arrays are sorted in place."
3. `src/testing/getDBDiffSince.ts`
   - `before: DBSnapshot`. Body:
     `const after = await getDBSnapshot(before.refs)`, then
     `return getDBChangesDiff(getDBChanges(before, after, masks))`.
   - Remove the `getSnapshotInputs` import, the throw, and the
     `QueryDocumentSnapshot` import if it is no longer used.
   - JSDoc: drop the "must be the array / a copy makes this throw" sentence and
     say it re-reads the refs `before` carries.
4. Delete `src/testing/internal/snapshotInputs.ts` (`git rm`).
5. `README.md` (admin)
   - Testing prose (about :554-566): replace "it re-reads the same refs for the
     after snapshot, so `before` must be the array `getDBSnapshot` returned, not
     a copy" with wording saying `getDBSnapshot` returns a `DBSnapshot`, an object
     holding the documents (`docs`) and the refs they were read from (`refs`),
     and `getDBDiffSince` re-reads those refs for the after snapshot. Keep the
     masks sentences and the sentence about `getDBChanges` /
     `getDBChangesDiff`. The example code block stays as it is.
   - API reference (about :794-806): the snapshot bullet says
     `getDBSnapshot(inputs)` returns a `DBSnapshot` (`{ docs, refs }`) and
     `getDBChanges(before, after, masks?)` takes two of them. The
     `getDBDiffSince` bullet says it re-reads the `refs` of a `DBSnapshot`. Add
     **`DBSnapshot`** to the exported-types list, next to `SnapshotInput`.
   - Do not restate any dependency version range (CLAUDE.md).
6. Fixture `src/__test__/utils/createDBSnapshot.ts`:
   `export const createDBSnapshot = (docs: QueryDocumentSnapshot[], refs: SnapshotInput[] = []): DBSnapshot => ({ docs, refs })`
   with a one-line JSDoc. It wraps hand-built docs for unit tests that call
   `getDBChanges` directly.
7. Tests:
   - `getDBChanges.test.ts` and `getDBChangesDiff.test.ts`: wrap every array
     argument to `getDBChanges` in `createDBSnapshot(...)`, for example
     `getDBChanges(createDBSnapshot([before]), createDBSnapshot([after]))`. The
     inline snapshots must not change. The "sorts both snapshot arrays in place"
     test (`getDBChanges.test.ts:232-250`) builds the two snapshots, calls
     `getDBChanges`, and asserts on `before.docs` / `after.docs` order.
   - `getDBSnapshot.test.ts`: tests that read `docs` read `.docs` from the result
     (`getPaths(snapshot.docs)`). `toEqual([])` (line 64) becomes
     `toEqual({ docs: [], refs: [] })`. Replace the "no extra own enumerable
     keys" test (lines 67-77, which pinned the WeakMap) with "carries its inputs
     as refs": a single bare query comes back as `refs: [query]`, and a mixed
     array of a refs object and a bare query comes back as that same array, in
     order, with the refs object itself (not its resolved query).
   - `getDBDiffSince.test.ts`: delete `MissingRefsError` and the `it.each`
     "throws for ..." cases (lines 9-10, 90-99). In the first two tests, wrap the
     expected three-step arrays with `createDBSnapshot`. Rename "can be called
     twice on the same before snapshot" and fix its comment, which mentions the
     refs record surviving the sort. Add "accepts a hand-built snapshot":
     `getDBDiffSince(createDBSnapshot(beforeDocs(), [query]))` gives the same
     diff as one taken with `getDBSnapshot(query)`.

## Gotchas

- Release footer: this is the second breaking change on the branch. The
  squashed commit must carry one `BREAKING CHANGE:` footer naming both
  changes. Put this task's part in its own commit message so the ship step finds
  it, e.g.
  `BREAKING CHANGE: getDBSnapshot (firebase-kit-admin/testing) returns a DBSnapshot { docs, refs } instead of an array, and getDBChanges / getDBDiffSince accept only that object. A test that iterates a snapshot, reads .length or compares it to an array must read .docs.`
  Per repo CLAUDE.md, `!` after the type is not enough on its own.
- The working tree holds the owner's uncommitted dependency update
  (`package.json` files, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases/`). Do not
  stage, commit, revert or reformat any of it. Stage only this task's files by
  path, plus the `git rm` of `snapshotInputs.ts` (never `git add -A` /
  `git add .`). Format only the touched files
  (`yarn prettier --write <files>`), not the whole repo with `yarn format`.
- Keep the in-place sort of `docs` in `getDBChanges`. The amendment changes the
  input shape, nothing else.
- Do not make the fields `readonly`. `getDBChanges` sorts `docs` in place, so a
  `readonly QueryDocumentSnapshot[]` would not type-check there.
- `grep -rn snapshotInputs` over `packages/firebase-kit-admin/src` must come
  back empty afterwards. `yarn build` fails on a dangling import.
- Test file convention (CLAUDE.md): `vi.mock` calls directly below the imports,
  `vi.hoisted` state above them, every other declaration below.
- Comments stay within the repo's 80-character limit.

## Verification

- Check: `yarn lint` and `yarn build` from `/Users/eric/Code/firebase-kit`.
- `yarn test:unit`: the updated `getDBChanges.test.ts`,
  `getDBChangesDiff.test.ts`, `getDBSnapshot.test.ts` and
  `getDBDiffSince.test.ts` pass with their inline snapshots unchanged, plus the
  new "carries its inputs as refs" and "accepts a hand-built snapshot" tests.
- `yarn test:emulator`: `createRunBatch.emulator.test.ts` and
  `createRunTransaction.emulator.test.ts` still pass unchanged. They exercise
  `getDBSnapshot` → `getDBChanges` against the real emulator.
- `grep -rn "snapshotInputs\|needs the array getDBSnapshot" /Users/eric/Code/firebase-kit/packages --exclude-dir=node_modules --exclude-dir=dist`
  returns nothing.
- README (config test exception): `yarn pack` the admin package into a throwaway
  consumer project outside the repo and type-check the
  `src/spaces/renameSpace.emulator.test.ts` example verbatim, extracted to its
  header path with the `db.ts`, `spaceRefs.ts` and `renameSpace.ts` blocks it
  imports. In that consumer, also type-check
  `import type { DBSnapshot } from 'firebase-kit-admin/testing'`.
- `git status` shows the owner's dependency files still modified and
  uncommitted.
