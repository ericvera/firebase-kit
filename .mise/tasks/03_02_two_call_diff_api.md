# 03_02 The testing diff API becomes two calls on a before snapshot

## Goal

Cut the public diff surface of `firebase-kit-admin/testing` down to two calls
that each take the `DBSnapshot` `getDBSnapshot` returned:

- `getDBChangesDiff(before, masks?)`: re-reads `before.refs` and returns the
  printable `DB DIFF` string. This is today's `getDBDiffSince`, renamed.
- `expectNoDBChanges(before)` (new): re-reads `before.refs` and throws, with the
  printed diff in the message, when any document was added, removed or
  modified. It takes no masks.

`getDBChanges(before, after, masks?)` and the old renderer
`getDBChangesDiff(changes)` stop being exported and move under
`src/testing/internal/`. The changes-object types stop being exported. The
repo's own emulator tests move to the new call. This is a breaking public API
change. The admin README is rewritten by task 03_04, not here.

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/testing/internal/getDBChanges.ts` (moved from
  `src/testing/getDBChanges.ts` with `git mv`)
- `src/testing/internal/formatDBChanges.ts` (moved from
  `src/testing/getDBChangesDiff.ts` with `git mv`, function renamed)
- `src/testing/getDBChangesDiff.ts` (the former `src/testing/getDBDiffSince.ts`,
  moved with `git mv` after the line above, function renamed)
- `src/testing/expectNoDBChanges.ts` (create)
- `src/testing/index.ts` (modify)

Tests (they do not count toward the limit):

- `src/testing/getDBChanges.test.ts` → `src/testing/internal/getDBChanges.test.ts` (`git mv`)
- `src/testing/getDBChangesDiff.test.ts` → `src/testing/internal/formatDBChanges.test.ts` (`git mv`)
- `src/testing/getDBDiffSince.test.ts` → `src/testing/getDBChangesDiff.test.ts` (`git mv`, after the line above)
- `src/testing/expectNoDBChanges.test.ts` (create)
- `src/firestore/internal/createRunBatch.emulator.test.ts` (modify)
- `src/firestore/internal/createRunTransaction.emulator.test.ts` (modify)

## Background

All paths below are under `packages/firebase-kit-admin/src`.

What task 03_01 produced (committed before this task):

- `testing/getDBSnapshot.ts` exports `interface DBSnapshot { docs:
  QueryDocumentSnapshot[]; refs: SnapshotInput[] }` and
  `getDBSnapshot(inputs): Promise<DBSnapshot>`. `refs` is always an array.
- `testing/getDBChanges.ts`: `getDBChanges<TCollection>(before: DBSnapshot,
  after: DBSnapshot, masks?): DBSnapshotChanges`. It sorts both `docs` arrays
  in place. It imports `ascCompare`, `DocumentChangeSnapshot` classes and type,
  `extractTimestamps`, `maskModifiedProps`, `maskProps` and `normalizeData` from
  `./internal/*.js`, and `DBSnapshot` as a type from `./getDBSnapshot.js`.
- `testing/getDBChangesDiff.ts`: `getDBChangesDiff(changes: DBSnapshotChanges):
  string`, the renderer that builds the `DB DIFF` text. Its only import is the
  `DBSnapshotChanges` type from `./internal/DocumentChangeSnapshot.js`.
- `testing/getDBDiffSince.ts`: `getDBDiffSince<TCollection>(before: DBSnapshot,
  masks?): Promise<string>`, which does `getDBSnapshot(before.refs)` and returns
  `getDBChangesDiff(getDBChanges(before, after, masks))`. No error path.
- Fixture `__test__/utils/createDBSnapshot.ts`:
  `createDBSnapshot(docs, refs = [])` wraps hand-built docs as a `DBSnapshot`.
- `testing/index.ts` today:

  ```ts
  export * from './createRequestBuilders.js'
  export * from './createTaskRequest.js'
  export * from './emulator/index.js'
  export * from './expectSuccessResult.js'
  export * from './getDBChanges.js'
  export * from './getDBChangesDiff.js'
  export * from './getDBDiffSince.js'
  export * from './getDBSnapshot.js'
  export * from './normalizeData.js'
  export * from './testGetFirestoreReset.js'
  export * from './types.js'

  export type * from './internal/DocumentChangeSnapshot.js'
  ```

- Emulator tests `firestore/internal/createRunBatch.emulator.test.ts` (two
  tests, lines ~38-40 and ~79-81) and
  `firestore/internal/createRunTransaction.emulator.test.ts` (one test, ~42-44)
  each do `afterSnapshot = await getDBSnapshot(refs)`,
  `changes = getDBChanges(beforeSnapshot, afterSnapshot)`,
  `diff = getDBChangesDiff(changes)` and pin `diff` with an inline snapshot.
  They import from `'../../testing/index.js'`. `refs` is
  `[spaceRefs.allQuery()]`.

Patterns to follow:

- A testing helper that asserts: `testing/expectSuccessResult.ts:1-13` (named
  async arrow export with a JSDoc saying when a test uses it). Unlike it,
  `expectNoDBChanges` imports nothing from `vitest`. It throws a plain `Error`.
- Unit tests with fake queries: `testing/getDBDiffSince.test.ts:12-17`
  (`createMutableQuery`, a `{ get }` fake whose `docs` the test swaps between
  the before and after read) and `:19-43` (`beforeDocs` / `afterDocs`
  factories). Tests carry a `// Verify:` comment above the assertion that says
  what the case proves.

Design decisions that reach this task (spec.md "Two-call diff API",
"What is removed" and `## Hard-to-undo`):

- Public after this task: `getDBSnapshot`, `DBSnapshot`, `TestableDBRef`,
  `SnapshotInput`, `getDBChangesDiff(before, masks?)`,
  `expectNoDBChanges(before)`, plus the unrelated existing exports.
- Not public after this task: `getDBChanges`, the renderer (now
  `formatDBChanges`), `getDBDiffSince` (never released), and the types
  `DBSnapshotChanges`, `AddedDocumentSnapshot`, `RemovedDocumentSnapshot`,
  `ModifiedDocumentSnapshot`, `UnmodifiedDocumentSnapshot`. They are dropped
  outright, not kept as type-only exports, because no public call produces or
  takes them any more. `internal/DocumentChangeSnapshot.ts` itself does not
  change.
- "Modified" in `expectNoDBChanges` means what it means in the diff: a changed
  `updateTime`. A document rewritten with identical data therefore fails with a
  `MODIFIED` header and an empty body, and a document whose data changed while
  its `updateTime` did not passes. `unmodified` documents never fail it.
- `expectNoDBChanges` has no masks parameter. It calls `getDBChanges(before,
  after)` with no masks.
- Inline snapshot texts do not change anywhere in this task. Only the calls
  that produce them do.

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. Moves, in this order, from
   `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin`:

   ```sh
   git mv src/testing/getDBChanges.ts src/testing/internal/getDBChanges.ts
   git mv src/testing/getDBChanges.test.ts src/testing/internal/getDBChanges.test.ts
   git mv src/testing/getDBChangesDiff.ts src/testing/internal/formatDBChanges.ts
   git mv src/testing/getDBChangesDiff.test.ts src/testing/internal/formatDBChanges.test.ts
   git mv src/testing/getDBDiffSince.ts src/testing/getDBChangesDiff.ts
   git mv src/testing/getDBDiffSince.test.ts src/testing/getDBChangesDiff.test.ts
   ```

2. `src/testing/internal/getDBChanges.ts`: fix the imports for the new folder
   (`./ascCompare.js`, `./DocumentChangeSnapshot.js`, `./extractTimestamps.js`,
   `./maskModifiedProps.js`, `./maskProps.js`, `./normalizeData.js`, and
   `import type { DBSnapshot } from '../getDBSnapshot.js'`). No logic change.
   The JSDoc stops describing it as something a test calls; it says it diffs
   two snapshots into the changes object that `getDBChangesDiff` and
   `expectNoDBChanges` render.
3. `src/testing/internal/formatDBChanges.ts`: rename the function to
   `formatDBChanges(changes: DBSnapshotChanges): string`. Body unchanged. The
   JSDoc says it renders a changes object as the `DB DIFF` text.
4. `src/testing/getDBChangesDiff.ts` (former `getDBDiffSince.ts`):

   ```ts
   export const getDBChangesDiff = async <TCollection extends string = string>(
     before: DBSnapshot,
     masks?: Partial<Record<TCollection, string[]>>,
   ): Promise<string> => {
     const after = await getDBSnapshot(before.refs)

     return formatDBChanges(getDBChanges(before, after, masks))
   }
   ```

   Imports `getDBChanges` from `./internal/getDBChanges.js`, `formatDBChanges`
   from `./internal/formatDBChanges.js`, `getDBSnapshot` and the `DBSnapshot`
   type from `./getDBSnapshot.js`. JSDoc: an emulator test takes `before` with
   `getDBSnapshot`, runs the code under test, then pins this call's result.
   `masks` names per-collection fields whose values are not stable enough to
   assert on, keyed so an app's own collection enum catches a typo. Carry over
   the masks paragraph from the moved `getDBChanges` JSDoc, since that function
   is no longer public.
5. `src/testing/expectNoDBChanges.ts` (new):

   ```ts
   export const expectNoDBChanges = async (before: DBSnapshot): Promise<void> => {
     const after = await getDBSnapshot(before.refs)
     const changes = getDBChanges(before, after)

     if (
       changes.added.length === 0 &&
       changes.removed.length === 0 &&
       changes.modified.length === 0
     ) {
       return
     }

     throw new Error(
       `Expected no DB changes, found:\n\n${formatDBChanges(changes)}`,
     )
   }
   ```

   JSDoc: asserts the code under test left the documents behind `before`'s refs
   untouched; a failure prints the same `DB DIFF` text `getDBChangesDiff` would.
   Mention that it takes no masks, and that a rewrite with identical data counts
   as a change because the document's `updateTime` moved.
6. `src/testing/index.ts`: remove the `./getDBChanges.js` and
   `./getDBDiffSince.js` lines and the trailing
   `export type * from './internal/DocumentChangeSnapshot.js'` line (and the
   blank line before it). Add `export * from './expectNoDBChanges.js'` in
   alphabetical position (after `./emulator/index.js`). Keep
   `./getDBChangesDiff.js` and `./getDBSnapshot.js`.
7. Tests:
   - `internal/getDBChanges.test.ts`: fix import paths
     (`../../__test__/utils/createDocSnapshot.js`,
     `../../__test__/utils/createDBSnapshot.js`, `./getDBChanges.js`). No
     other change.
   - `internal/formatDBChanges.test.ts`: fix import paths, import
     `formatDBChanges` from `./formatDBChanges.js` and `getDBChanges` from
     `./getDBChanges.js`, rename every `getDBChangesDiff(` call to
     `formatDBChanges(`. Inline snapshots unchanged.
   - `getDBChangesDiff.test.ts` (former `getDBDiffSince.test.ts`): import
     `getDBChangesDiff` from `./getDBChangesDiff.js`, and the expected values'
     `getDBChanges` / `formatDBChanges` from `./internal/getDBChanges.js` /
     `./internal/formatDBChanges.js`. Rename every `getDBDiffSince(` to
     `getDBChangesDiff(` and every reference in test titles and comments. The
     "returns the same diff as the three-step form" title becomes "returns the
     formatted changes since the before snapshot" or similar.
   - `expectNoDBChanges.test.ts` (new), using a local `createMutableQuery` and
     `createDocSnapshot` as in `getDBChangesDiff.test.ts`:
     - "resolves when nothing changed": same docs (same `updateTimeMs`) before
       and after, `await expect(expectNoDBChanges(before)).resolves.toBeUndefined()`.
     - "resolves when data changed but updateTime did not": pins the
       `updateTime` definition.
     - "rejects with the diff when a document was added", "... removed", and
       "... modified" (different `updateTimeMs`). At least one of them pins the
       whole message with `rejects.toThrowErrorMatchingInlineSnapshot()`, so the
       `Expected no DB changes, found:` line and the `DB DIFF` body are
       covered.
     - "rejects for a rewrite with identical data": same data, newer
       `updateTimeMs`, message contains `MODIFIED (path: `.
     - "re-reads every input": a refs object and a bare query, both
       `get` spies called twice, as in the "re-reads every input" test of
       `getDBChangesDiff.test.ts`.
   - Emulator tests: in `createRunBatch.emulator.test.ts` and
     `createRunTransaction.emulator.test.ts`, replace the three lines
     (`afterSnapshot`, `changes`, `diff`) with
     `expect(await getDBChangesDiff(beforeSnapshot)).toMatchInlineSnapshot(...)`,
     keeping each inline snapshot text byte for byte. Imports become
     `getDBChangesDiff, getDBSnapshot` (plus `expectNoDBChanges` where used).
     In `createRunTransaction.emulator.test.ts`, add "leaves the database
     untouched when the transaction only reads": `addSpaceToDB(now)`, take
     `beforeSnapshot`, run a transaction that only `reader.get`s
     `spaceRefs.doc(TestSpaceID1)`, then `await expectNoDBChanges(beforeSnapshot)`.
     Keep the existing `// Ensure that the name was updated` comment's intent.

## Gotchas

- Release footer: put this task's part in its own commit message so the ship
  step finds it, for example
  `BREAKING CHANGE: firebase-kit-admin/testing no longer exports getDBChanges or the changes-object types (DBSnapshotChanges, AddedDocumentSnapshot, RemovedDocumentSnapshot, ModifiedDocumentSnapshot, UnmodifiedDocumentSnapshot). getDBChangesDiff now takes the before DBSnapshot and optional masks, re-reads its refs and resolves to the diff string: replace getDBChangesDiff(getDBChanges(before, after)) with await getDBChangesDiff(before). New expectNoDBChanges(before) asserts nothing changed.`
  Per repo CLAUDE.md, `!` after the type is not enough on its own.
- The working tree holds the owner's uncommitted dependency update
  (`package.json` files, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases/`). Do not
  stage, commit, revert or reformat any of it. Stage only this task's files by
  path (the `git mv`s stage themselves), never `git add -A` / `git add .`.
  Format only the touched files (`yarn prettier --write <files>`), not
  `yarn format`.
- Do the `git mv` of `getDBChangesDiff.ts` before moving `getDBDiffSince.ts`
  onto that name, or the second move overwrites the renderer.
- `getDBChangesDiff` keeps its old public name with a new signature. A stale
  import anywhere of the renderer under that name type-checks badly, so grep:
  `grep -rn "getDBDiffSince\|from './getDBChanges.js'\|from '../getDBChanges.js'" packages/firebase-kit-admin/src`
  must come back empty afterwards, and every remaining `getDBChangesDiff(` call
  must pass a `DBSnapshot`.
- `tsc --build` does not delete `dist/testing/getDBChanges.*` or
  `dist/testing/getDBDiffSince.*` from earlier builds. They are unreachable
  through `exports` and harmless for Check, but do not read them as proof that
  anything still exports those names.
- Runtime import graph: `getDBChangesDiff.ts` and `expectNoDBChanges.ts` import
  `getDBSnapshot` at runtime, and `internal/getDBChanges.ts` imports only the
  `DBSnapshot` type from it, so there is no cycle.
- Test file convention (CLAUDE.md): `vi.mock` calls directly below the imports,
  `vi.hoisted` state above them, every other declaration below.
- Comments stay within the repo's 80-character limit. Review checklist
  (`.claude/mise-checklist.md`) rule 7: no colons, semicolons or em-dashes
  inside comment or JSDoc prose.

## Verification

- Check: `yarn lint` and `yarn build` from `/Users/eric/Code/firebase-kit`.
- `yarn test:unit`: the moved `internal/getDBChanges.test.ts`,
  `internal/formatDBChanges.test.ts` and `getDBChangesDiff.test.ts` pass with
  their inline snapshots unchanged. The new `expectNoDBChanges.test.ts` passes.
- `yarn test:emulator`: `createRunBatch.emulator.test.ts` and
  `createRunTransaction.emulator.test.ts` pass with their inline snapshots
  unchanged, plus the new read-only transaction test, which exercises
  `expectNoDBChanges` against the real emulator.
- Public surface check: `node -e "import('/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/dist/testing/index.js').then((m) => console.log(Object.keys(m).sort().join('\n')))"`
  after `yarn build` lists `expectNoDBChanges`, `getDBChangesDiff` and
  `getDBSnapshot`, and neither `getDBChanges` nor `getDBDiffSince`.
- `git status` shows the owner's dependency files still modified and
  uncommitted.
