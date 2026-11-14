# Review

## Tasks

- 01_01 (30ed90d) — mask entries resolve as dotted paths at runtime. `maskProps` and `maskModifiedProps` read and write through path helpers, copying each map along the path so caller data is never mutated. Verify: `yarn test:unit`; read the nested cases in `internal/maskProps.test.ts`, `internal/maskModifiedProps.test.ts` and the nested numbering and no-mutation tests in `internal/getDBChanges.test.ts`.
- 01_02 (d1e0adb) — `getDBChangesDiff<TSchema>` plus exported `DBMasks<TSchema>`, paths checked with `keyof UpdateData<Doc>`; masks without a schema do not compile; internal `getDBChanges` loses its `TCollection` generic; README masks paragraph, example and API lines rewritten. Verify: the `@ts-expect-error` cases and the `'meta.at'` snapshot in `packages/firebase-kit-admin/src/testing/getDBChangesDiff.test.ts`; `yarn lint && yarn build && yarn test`; README section "masks" in `packages/firebase-kit-admin/README.md`.
- 02_01 (00846b2) — the path helpers split into `internal/isMap.ts`, `internal/readPath.ts` and `internal/writePath.ts`, one function per file, each with its own test file. Verify: the three test files hold the six cases the old `maskPath.test.ts` held.
- 02_02 (96fc114) — `maskProps` and `maskModifiedProps` import the split helpers, `maskPath.ts` and its test are deleted. Verify: `git grep -n maskPath -- packages` prints nothing.
- 02_03 (73ee54d) — helpers that number documents among their siblings: `compareCodeUnits`, `getCollectionPatterns`, `getDocNumbers`, `getParentPatterns`, `getDocPathSegments`, all under `packages/firebase-kit-admin/src/testing/internal/`. Verify: `internal/getDocNumbers.test.ts` (content ranking, pre-existing first, identical siblings share a number) and `internal/getDocPathSegments.test.ts`.
- 02_04 (9bc6916) — a subcollection document's parent prints as `[ID n]` instead of a content hash, and a collection's documents print their number in their own sections when the diff holds their children. `internal/formatDocPath.ts` is new, the hash code is gone from `internal/DocumentChangeSnapshot.ts`, numbering is wired into `internal/getDBChanges.ts`. Verify: the six numbering tests at the end of `internal/getDBChanges.test.ts`.
- 02_05 (baa62b3) — sections sort by path, then kind, then body, so a parent sits directly above its children. `internal/compareDocPaths.ts` is new, `internal/formatDBChanges.ts` sorts with it, README paragraph and `getDBChangesDiff` JSDoc describe the numbering. Verify: the ordering tests in `internal/formatDBChanges.test.ts`, `names a parent by number and lists its children under it` in `getDBChangesDiff.test.ts`, and the README paragraph after the `getDBSnapshot` introduction.
- 03_01 (f0afb8d) — `getDBChangesDiff` throws when no document was added, removed or modified, with a message pointing at `expectNoDBChanges`. Verify: the three `throws` tests in `getDBChangesDiff.test.ts`, the README testing paragraph and API line, `yarn lint && yarn build && yarn test`.

## Open assumptions

- No `FieldPath` entries: a field whose name contains a literal `.` cannot be masked on its own.
- A nested map declared as a named `interface` gets no dotted keys (Firestore's own behavior); documents are interfaces with nested maps written inline. The README says so.
- Paths walk maps only; an array is masked whole. A path through a missing map, or a non-map, is skipped silently.
- `maskModifiedProps` falls back to plain masking on both sides when either side is a class instance rather than a plain map.
- `readPath` does not check that the root object is a map, keeping the old top-level behavior for any object `maskProps` accepts.
- Two new tests (skip on missing map or array, nested no-mutation) also pass on the old code; they are regression guards.
- Release: three single-line `BREAKING CHANGE:` footers, on the 01_02, 02_05 and 03_01 commits, are repeated verbatim in the pull request description. Take them with `git log --format=%B main..HEAD | grep '^BREAKING CHANGE:'`. Text that follows the footer in the squash body leaks into the release note unless the footer is the last paragraph of the squash message at merge.
- A parent's number is its rank among the documents of its collection in the snapshot, so a narrower `getDBSnapshot` query numbers differently. It can change when an edit makes one sibling sort past another.
- Consumers re-record every snapshot that holds a subcollection document or more than one kind of change, and move empty-diff snapshots to `expectNoDBChanges`.
- Out of scope: replacing the okven `maskTopUpRetryStartedAt` helper; masks on `expectNoDBChanges`.

## Amendments

- 2026-11-14 amendment 1, tasks 02_01 to 02_05: numbered parents instead of a content hash, numbers in the parent collection's own sections, sections sorted by path before kind, `maskPath.ts` split into one file per function.
- 2026-11-14 amendment 2, task 03_01: `getDBChangesDiff` throws when nothing changed, `expectNoDBChanges` stays.
