# 03_04 Admin README moves to the two-call diff API

## Goal

Bring the `firebase-kit-admin` README's testing section and API reference in
line with the API tasks 03_01 to 03_03 built: `getDBSnapshot` returns a
`DBSnapshot` (`{ docs, refs }`), `getDBChangesDiff(before, masks?)` re-reads its
refs and returns the printable diff, `expectNoDBChanges(before)` asserts that
nothing changed, masked fields take no part in the `/Timestamp NNNN/`
numbering, and a masked Timestamp prints `/Timestamp/`. `getDBChanges`,
`getDBDiffSince` and the changes-object types disappear from the README.
Docs only.

## Files to modify/create

- `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/README.md` (modify)

## Background

What the prior tasks produced (all under
`packages/firebase-kit-admin/src/testing`):

- `getDBSnapshot.ts` (03_01): `interface DBSnapshot { docs:
  QueryDocumentSnapshot[]; refs: SnapshotInput[] }`,
  `getDBSnapshot(inputs): Promise<DBSnapshot>`.
- `getDBChangesDiff.ts` (03_02): `getDBChangesDiff(before: DBSnapshot,
  masks?): Promise<string>`, re-reads `before.refs`.
- `expectNoDBChanges.ts` (03_02): `expectNoDBChanges(before: DBSnapshot):
  Promise<void>`, throws an `Error` whose message is
  `Expected no DB changes, found:`, a blank line and the `DB DIFF` text, when
  any document was added, removed or modified (a changed `updateTime` counts as
  modified). No masks.
- `index.ts` (03_02) no longer exports `getDBChanges`, `getDBDiffSince` or the
  types `DBSnapshotChanges`, `AddedDocumentSnapshot`,
  `RemovedDocumentSnapshot`, `ModifiedDocumentSnapshot`,
  `UnmodifiedDocumentSnapshot`. It does export `DBSnapshot`.
- `internal/getDBChanges.ts` / `internal/maskProps.ts` (03_03): masking runs
  before timestamp numbering. A masked Timestamp prints `"/Timestamp/"`, or
  `"/Timestamp (before)/"` / `"/Timestamp (after)/"` when it changed. Other
  tokens (`/String/`, `/Number/`, `/Map/`, ...) are unchanged.

The README today (line numbers approximate):

- `:554-565` testing prose: names `getDBDiffSince`, says `before` "must be the
  array `getDBSnapshot` returned, not a copy", describes masks and the
  `"/String (before)/"` / `"/String (after)/"` labels, and says
  `getDBChanges(before, after, masks?)` and `getDBChangesDiff(changes)` remain
  for a test that needs the changes object.
- `:567-585` example `// src/spaces/renameSpace.emulator.test.ts`: imports
  `getDBDiffSince, getDBSnapshot`, and calls
  `getDBDiffSince(before, { spaces: ['updated'] })`. `renameSpace` (`:255-283`)
  throws through `checkDocumentExists` when the space does not exist.
- `:794-806` API reference under `### firebase-kit-admin/testing`: bullets for
  `getDBSnapshot(inputs)`, `getDBChanges(before, after, masks?)`,
  `getDBChangesDiff(changes)`, `getDBDiffSince(before, masks?)`,
  `normalizeData`, and the exported-types list ending with the five
  changes-object types.

Design decisions that reach this task (spec.md "Two-call diff API", "Masked
fields leave the timestamp numbering", `## Hard-to-undo`):

- The public diff surface is exactly `getDBSnapshot`, `getDBChangesDiff`,
  `expectNoDBChanges`, and the `DBSnapshot`, `TestableDBRef`, `SnapshotInput`
  types.
- The README never restates a dependency version range (repo CLAUDE.md).

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. Testing prose (`:554-565`): replace with wording that says
   - `getDBSnapshot` returns a `DBSnapshot`, an object holding the documents
     read (`docs`) and the refs they came from (`refs`);
   - after the code under test runs, `getDBChangesDiff(before, masks?)`
     re-reads those refs and returns the printable diff to pin with an inline
     snapshot, and `expectNoDBChanges(before)` re-reads them and fails, printing
     the diff, if any document was added, removed or modified (a rewrite with
     identical data counts, because the document's update time moved);
   - masks are per-collection field lists keyed by the app's collection names,
     for values not stable enough to assert on; a masked field that changed
     shows as a `-` / `+` pair whose tokens read `(before)` and `(after)` (for
     example `"/String (before)/"` and `"/String (after)/"`), an unchanged one
     keeps the plain token, and a masked Timestamp prints `"/Timestamp/"`;
   - masked fields are left out of the `/Timestamp NNNN/` numbering, so masking
     one timestamp does not shift the others' numbers.
   Drop the "must be the array, not a copy" sentence and the sentence about
   `getDBChanges` / `getDBChangesDiff(changes)`. Keep "This example needs a
   running Firestore emulator and the setup file above."
2. Example block: import
   `{ expectNoDBChanges, getDBChangesDiff, getDBSnapshot }` from
   `'firebase-kit-admin/testing'`. The existing test calls
   `await getDBChangesDiff(before, { spaces: ['updated'] })` inside
   `expect(...).toMatchInlineSnapshot()`. Add a second test, for example
   `'leaves the database untouched for a missing space'`: take `before`, then
   `await expect(renameSpace(undefined, 'missing', 'Renamed')).rejects.toThrow()`,
   then `await expectNoDBChanges(before)`. Keep the header comment path.
3. API reference (`:794-806`): replace the snapshot / diff bullets with
   - **`getDBSnapshot(inputs)`**: reads the refs or queries into a
     `DBSnapshot` (`{ docs, refs }`).
   - **`getDBChangesDiff(before, masks?)`**: re-reads `before.refs` and returns
     the printable diff since it.
   - **`expectNoDBChanges(before)`**: re-reads `before.refs` and fails with the
     printed diff if any document was added, removed or modified.
   In the exported-types list, add **`DBSnapshot`** next to `SnapshotInput`
   and remove `DBSnapshotChanges`, `AddedDocumentSnapshot`,
   `RemovedDocumentSnapshot`, `ModifiedDocumentSnapshot` and
   `UnmodifiedDocumentSnapshot`.
4. Grep the whole README afterwards for `getDBChanges(`, `getDBDiffSince`,
   `DBSnapshotChanges`, `DocumentSnapshot\*\*` and `not a copy`. None may
   remain.

## Gotchas

- Stage only the README by path. The working tree holds the owner's
  uncommitted dependency update (`package.json` files, `yarn.lock`,
  `.yarnrc.yml`, `.yarn/releases/`). Do not stage, commit, revert or reformat
  any of it, never `git add -A` / `git add .`. Format only the README
  (`yarn prettier --write packages/firebase-kit-admin/README.md`).
- `tsc --build` leaves stale `dist/testing/getDBChanges.*`,
  `dist/testing/getDBChangesDiff.*` and `dist/testing/getDBDiffSince.*` files
  from before 03_02 in place, and `"files": ["dist"]` would pack them. Before
  `yarn pack`, delete `packages/firebase-kit-admin/dist` and
  `packages/firebase-kit-admin/tsconfig.tsbuildinfo` and run `yarn build`, so
  the tarball holds only current output.
- Review checklist (`.claude/mise-checklist.md`) rule 7: no colons,
  semicolons or em-dashes inside Markdown prose, except a colon that
  introduces a code block, table or list. The bullets above are content, not
  wording to copy.
- Every install command block shows the npm form and the yarn form (`# or`)
  if one is touched (repo CLAUDE.md). This task should not need to touch any.

## Verification

- Check: `yarn lint` and `yarn build` from `/Users/eric/Code/firebase-kit`
  (no source changes, so both stay green).
- Config test exception (README snippets): after the clean build above,
  `yarn pack` `packages/firebase-kit-admin` (and `firebase-kit-protocol`, which
  it depends on) into a throwaway consumer project outside the repo. Extract
  `src/spaces/renameSpace.emulator.test.ts` verbatim to its header path, with
  the `db.ts`, `spaceRefs.ts` and `renameSpace.ts` blocks it imports, and run
  `tsc --noEmit` on them. Also type-check
  `import type { DBSnapshot } from 'firebase-kit-admin/testing'`, and confirm
  that `import { getDBChanges } from 'firebase-kit-admin/testing'` fails to
  type-check. Reading the snippets is not verification.
- Grep from step 4 comes back empty.
- `git status` shows the owner's dependency files still modified and
  uncommitted.
