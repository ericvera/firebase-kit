# 03_03 Masked fields leave the timestamp numbering

## Goal

In `firebase-kit-admin/testing`'s diff, mask each document's fields before the
`/Timestamp NNNN/` numbering instead of after it, so a masked field (a masked
Timestamp, or a Timestamp nested in a masked Map or Array) takes no index and
no longer shifts the number of every later timestamp. A masked Timestamp
prints its class name, `"/Timestamp/"`, or `"/Timestamp (before)/"` /
`"/Timestamp (after)/"` when its value changed, instead of today's
`"/String/"`. Every other mask token stays as it is. This is a change to the
default diff output (consumer inline snapshots that mask a timestamp field
renumber and retoken once). It joins the branch's `BREAKING CHANGE:` footer.

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/testing/internal/getDBChanges.ts` (modify)
- `src/testing/internal/maskProps.ts` (modify)
- `src/testing/internal/maskModifiedProps.ts` (modify, JSDoc only)

Tests (they do not count toward the limit):
`src/testing/internal/getDBChanges.test.ts`,
`src/testing/internal/maskProps.test.ts`,
`src/testing/internal/maskModifiedProps.test.ts`,
`src/testing/getDBChangesDiff.test.ts`.

## Background

All paths below are under `packages/firebase-kit-admin/src/testing`.

What prior tasks produced:

- Task 03_02 moved `getDBChanges` to `internal/getDBChanges.ts` (no longer
  exported) with signature `getDBChanges<TCollection>(before: DBSnapshot,
  after: DBSnapshot, masks?): DBSnapshotChanges` (`DBSnapshot` is
  `{ docs, refs }`, from `getDBSnapshot.ts`, task 03_01). Its tests are in
  `internal/getDBChanges.test.ts` and wrap docs with
  `createDBSnapshot(docs)` from `../../__test__/utils/createDBSnapshot.js`.
  The public entry points are `getDBChangesDiff(before, masks?)` and
  `expectNoDBChanges(before)`, both of which call it.
- The flow in `internal/getDBChanges.ts` today (line numbers from before the
  move, `getDBChanges.ts:39-153`, shift by a few lines):
  1. Collect `extractTimestamps(doc.data())` over every before and after doc
     into one set, sort it (`sortedTimestamps`).
  2. Sort each side's `docs` in place by `updateTime`, and map each doc to
     `{ doc, normalizedData: normalizeData(doc.data(), sortedTimestamps) }`.
  3. For each after doc: added → `maskProps(afterNormalizedData, ...)`, build
     `AddedDocumentSnapshot`. Otherwise find the before entry by path,
     `maskModifiedProps(beforeNormalizedData, afterNormalizedData, ...)`, then
     `ModifiedDocumentSnapshot` if `updateTime` differs, else
     `UnmodifiedDocumentSnapshot`.
  4. For each before doc missing from after: `maskProps(beforeNormalizedData,
     ...)`, build `RemovedDocumentSnapshot`.
- `internal/maskProps.ts`: `getTypeName(value)` (:1-20) maps `null` → `Null`,
  arrays → `Array`, string/number/boolean → `String`/`Number`/`Boolean`,
  anything else → `Map`. `getTypeToken(value, label?)` (:22-29) wraps it.
  `maskProps(a, collection, maskKeys)` (:33-59) replaces each present masked
  top-level key in place.
- `internal/maskModifiedProps.ts:14-48`: per masked key present on both sides,
  `isDeepStrictEqual` decides changed; changed → `(before)` / `(after)`
  tokens, else plain tokens. Mutates both objects in place.
- `internal/normalizeData.ts:28-40` throws `Timestamp not found in sorted
  array` for a Timestamp missing from the list, so every Timestamp that reaches
  `normalizeData` must have been collected.
- `__test__/utils/createDocSnapshot.ts`: `data()` returns the fixture's object
  by reference, not a copy, so mutating it would leak into other assertions.

Design decisions that reach this task (spec.md "Masked fields leave the
timestamp numbering" and the third 2026-11-13 amendment):

- Mask first, on a shallow copy of each document's raw data, then collect
  timestamps from the masked copies, then normalize the masked copies.
- `maskModifiedProps` compares raw values. A Firestore `Timestamp` keeps
  `_seconds` / `_nanoseconds` as own enumerable fields, so `isDeepStrictEqual`
  answers "same instant" (checked against the installed
  `@google-cloud/firestore`: equal for the same millis, unequal otherwise).
  Buffers compare by content. That matches what the normalized comparison
  answered.
- Owner decision: a raw Timestamp's type name is `Timestamp`, not `String`
  (today's token, from normalizing before masking) and not `Map` (what
  `getTypeName` returns for any other object). A raw Buffer used to be masked
  after normalization had turned it into a string, so `getTypeName` returns
  `String` for it and its token stays as today. A raw `DocumentReference` or
  `GeoPoint` is an object and still gets `Map`, as its normalized form did.
- Unmodified documents (on both sides, same `updateTime`) are masked with
  `maskModifiedProps` as today, so their masked fields leave the numbering too.
- `internal/DocumentChangeSnapshot.ts` does not change. Its subcollection path
  hash (`getNormalizedIDForPath`) keeps numbering a parent document's own
  timestamps without masks.

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `internal/maskProps.ts` `getTypeName`: before the `switch`, return
   `'Timestamp'` when `value instanceof Timestamp` (import `Timestamp` from
   `firebase-admin/firestore`), and `'String'` when `Buffer.isBuffer(value)`
   (import `Buffer` from `node:buffer`, as `internal/normalizeData.ts:2` does).
   Comment the Buffer case's why in one sentence (it printed as a normalized
   string before masking moved ahead of normalization, and consumer snapshots
   hold that token).
2. `internal/getDBChanges.ts`, restructure the body:
   1. Sort `before.docs` and `after.docs` in place by `updateTime` first (same
      comparator as today), so `beforeDocs` / `afterDocs` keep their current
      meaning and order.
   2. Build `maskedData = new Map<QueryDocumentSnapshot, Record<string,
      unknown>>()` (or two path-keyed maps) holding `{ ...doc.data() }` for
      every doc on both sides.
   3. Mask the copies: for each after doc, if a before doc has the same path,
      `maskModifiedProps(beforeCopy, afterCopy, afterDoc.ref.parent.id,
      maskKeys)`, else `maskProps(afterCopy, afterDoc.ref.parent.id,
      maskKeys)`. For each before doc with no after doc of the same path,
      `maskProps(beforeCopy, beforeDoc.ref.parent.id, maskKeys)`.
   4. Collect timestamps with `extractTimestamps` over the masked copies only
      and sort them, as today.
   5. Normalize each masked copy with `normalizeData(copy, sortedTimestamps)`
      and run the existing classification loops on the normalized values, with
      the `maskProps` / `maskModifiedProps` calls removed from them. Every
      `DocumentChangeSnapshot` constructor call keeps its arguments
      (`afterDocs` / `beforeDocs` as `allDocs`).
   Update the step comments. Drop any comment that restates the code.
3. `internal/maskModifiedProps.ts`: JSDoc only. Say it runs on raw document
   data before normalization, so its equality check sees real values
   (Timestamps compare by instant). No code change.
4. Tests:
   - `internal/getDBChanges.test.ts`:
     - New "leaves masked timestamps out of the numbering": a modified entry
       with masked `at` (Timestamp 1000 → 9000) and unmasked `updated`
       (Timestamp 5000 → 6000). Inline snapshot shows `at` as
       `/Timestamp (before)/` / `/Timestamp (after)/` and `updated` as
       `/Timestamp 0000/` → `/Timestamp 0001/` (today they would read 0001 →
       0002). This test fails before the change.
     - New "leaves a Timestamp inside a masked map out of the numbering":
       masked `meta: { at: Timestamp }` plus an unmasked Timestamp field on an
       added doc, which prints `/Timestamp 0000/` and `"meta": "/Map/"`.
     - New "does not modify the documents' data": keep a reference to a
       fixture's `data` object, run `getDBChanges` with masks covering one of
       its fields, and assert the object still holds the raw value (the
       Timestamp instance, not a token).
     - "labels a masked timestamp that was rewritten": its inline snapshot
       changes from `/String (before)/` / `/String (after)/` to
       `/Timestamp (before)/` / `/Timestamp (after)/`. Its comment ("the
       normalized index differs") becomes "the instants differ".
     - New "prints the Timestamp token for a masked Timestamp", pinning all
       three cases with inline snapshots: unchanged on a modified document
       (same instant on both sides, another field changed) prints
       `"/Timestamp/"` as a context line; changed prints the
       `/Timestamp (before)/` / `/Timestamp (after)/` pair; inside an added
       document prints `+   "at": "/Timestamp/"`.
     - Every other inline snapshot in the file stays unchanged.
   - `internal/maskProps.test.ts`: new "names a raw Timestamp by its class":
     `getTypeToken(Timestamp.fromMillis(0))` gives `/Timestamp/`, and with a
     label `/Timestamp (after)/`. New "renders a raw Buffer as the string
     token": `getTypeToken(Buffer.from('x'))` gives `/String/`.
   - `internal/maskModifiedProps.test.ts`: new "compares raw Timestamps by
     instant": equal millis on both sides keep the plain `/Timestamp/` token,
     different millis give the `/Timestamp (before)/` / `/Timestamp (after)/`
     pair.
   - `getDBChangesDiff.test.ts`: new "keeps unmasked timestamp numbers stable
     when a timestamp is masked", end to end through a mutable fake query: the
     same before/after docs diffed with and without `{ spaces: ['at'] }`, the
     masked diff's unmasked timestamp reads `/Timestamp 0000/` →
     `/Timestamp 0001/`. Pin with an inline snapshot.

## Gotchas

- Release footer: put this task's part in its own commit message so the ship
  step finds it, for example
  `BREAKING CHANGE: in firebase-kit-admin/testing diffs, masked fields no longer take part in the /Timestamp NNNN/ numbering, and a masked Timestamp prints /Timestamp/ (or /Timestamp (before)/ and /Timestamp (after)/) instead of /String/, so an inline snapshot that masks a timestamp field changes once.`
- Never mask the object `doc.data()` returns. The unit fixture hands back its
  own object by reference, and a real snapshot's data is the caller's too.
  Copy first (`{ ...doc.data() }`); masking is top-level only, so a shallow
  copy is enough.
- Keep the in-place sort of `before.docs` / `after.docs`. A test pins it.
- `normalizeData` throws for an uncollected Timestamp. If that error appears, a
  Timestamp reached normalization without being collected, which means the
  collection step read different data from the normalization step.
- The working tree holds the owner's uncommitted dependency update
  (`package.json` files, `yarn.lock`, `.yarnrc.yml`, `.yarn/releases/`). Do not
  stage, commit, revert or reformat any of it. Stage only this task's files by
  path, never `git add -A` / `git add .`. Format only the touched files
  (`yarn prettier --write <files>`), not `yarn format`.
- Test file convention (CLAUDE.md): `vi.mock` calls directly below the imports,
  `vi.hoisted` state above them, every other declaration below.
- Comments stay within the repo's 80-character limit. Review checklist
  (`.claude/mise-checklist.md`) rule 7: no colons, semicolons or em-dashes
  inside comment or JSDoc prose.

## Verification

- Check: `yarn lint` and `yarn build` from `/Users/eric/Code/firebase-kit`.
- `yarn test:unit`: the new tests listed above pass, "leaves masked timestamps
  out of the numbering" and "prints the Timestamp token for a masked Timestamp"
  fail on the code before this task, "labels a masked timestamp that was
  rewritten" passes with its updated snapshot, and every other existing
  inline snapshot in `internal/getDBChanges.test.ts`,
  `internal/formatDBChanges.test.ts`, `internal/DocumentChangeSnapshot.test.ts`,
  `internal/maskProps.test.ts`, `internal/maskModifiedProps.test.ts` and
  `getDBChangesDiff.test.ts` passes unchanged.
- `yarn test:emulator`: `createRunBatch.emulator.test.ts` and
  `createRunTransaction.emulator.test.ts` pass with their inline snapshots
  unchanged (they use no masks).
- `git status` shows the owner's dependency files still modified and
  uncommitted.
