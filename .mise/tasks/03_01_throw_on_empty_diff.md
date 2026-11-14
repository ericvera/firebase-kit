# 03_01 Make getDBChangesDiff throw when nothing changed

## Goal

`getDBChangesDiff(before, masks?)` in `firebase-kit-admin/testing` throws when no document was added, removed or modified, instead of returning an empty `DB DIFF` string. The error message points the caller at `expectNoDBChanges(before)`. `expectNoDBChanges` does not change. The owner wants this for two reasons. A `vitest -u` run can then never record an empty diff, and consumers get one way to assert that nothing changed. Every call in this package that diffs an unchanged database moves to `expectNoDBChanges` or to a diff that holds a change. The README and JSDoc say so, and the commit carries a third `BREAKING CHANGE:` footer.

## Files to modify/create

1. `packages/firebase-kit-admin/src/testing/getDBChangesDiff.ts`
2. `packages/firebase-kit-admin/README.md`

Tests: `packages/firebase-kit-admin/src/testing/getDBChangesDiff.test.ts` (new tests and one rewritten test).

## Background

- `getDBChangesDiff` (`packages/firebase-kit-admin/src/testing/getDBChangesDiff.ts:40-49`) re-reads `before.refs` with `getDBSnapshot`, then returns `formatDBChanges(getDBChanges(before, after, masks))`. When nothing changed, `formatDBChanges` (`internal/formatDBChanges.ts`) returns `"DB DIFF\n\n"`.
- `getDBChanges` (`internal/getDBChanges.ts`) returns a `DBSnapshotChanges` (`internal/DocumentChangeSnapshot.ts`) with `added`, `removed`, `modified` and `unmodified` arrays. A document counts as modified only when its `updateTime` moved, so a data change with the same `updateTime` is unmodified, and a rewrite with identical data whose `updateTime` moved is modified.
- Pattern to follow: `expectNoDBChanges` (`packages/firebase-kit-admin/src/testing/expectNoDBChanges.ts:13-28`) tests the same three arrays for emptiness. Use the same rule, so the two functions always agree on what "nothing changed" means. Masks do not affect the rule, because classification is by `updateTime`.
- Calls in this package that diff an unchanged database, found by grep across `packages/` (`getDBChangesDiff` appears in no other package):
  - `packages/firebase-kit-admin/src/testing/getDBChangesDiff.test.ts`, test `type checks mask paths against the schema` (near line 274). It builds `before = createDBSnapshot([])` with no refs, so every one of its seven calls finds nothing changed and would now reject. This is the only one.
  - Every other call (`getDBChangesDiff.test.ts` other tests, `src/firestore/internal/createRunBatch.emulator.test.ts:34,73`, `src/firestore/internal/createRunTransaction.emulator.test.ts:42`, the README example at `README.md:623`) diffs a database that holds a change. `createRunTransaction.emulator.test.ts` already uses `expectNoDBChanges` for its read-only case.
- `createDBSnapshot(docs, refs = [])` (`src/__test__/utils/createDBSnapshot.ts`) wraps docs as a `DBSnapshot`. With no refs the re-read is empty, so before docs come back as removed.
- Release rules (CLAUDE.md `## Releasing`): the squashed commit message decides the release, and a breaking change carries a `BREAKING CHANGE:` footer. The branch already carries two single-line footers, in the `Task 01_02` and `Task 02_05` commits (`git log --format=%B -1 baa62b3` shows the shape). A call that used to return `"DB DIFF\n\n"` now rejects, so consumers who recorded an empty diff break. This task adds a third single-line footer.
- Docs: README `packages/firebase-kit-admin/README.md:556-562` describes `getDBChangesDiff` and `expectNoDBChanges`, and the API list at `:848-851` has one line each. CLAUDE.md `## Documentation conventions` forbids restating dependency versions.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. In `getDBChangesDiff.ts`, keep the result of `getDBChanges(before, after, masks)` in a `changes` variable. When `changes.added`, `changes.removed` and `changes.modified` are all empty, throw an `Error`. Otherwise return `formatDBChanges(changes)`. The message names both functions and the fix, for example:

   ```text
   getDBChangesDiff found no added, removed or modified documents. Use expectNoDBChanges(before) to assert that nothing changed.
   ```

   Inline the emptiness check. Do not edit `expectNoDBChanges.ts`.
2. JSDoc on `getDBChangesDiff`: add that it throws when no document was added, removed or modified, and that `expectNoDBChanges` is the way to assert nothing changed, so an empty diff can never be recorded as a snapshot.
3. README, the paragraph at `README.md:556-562`: add a sentence saying `getDBChangesDiff` throws when nothing was added, removed or modified, pointing at `expectNoDBChanges` as the one way to assert that nothing changed. API line at `:848-849`: add "and throws if nothing changed" (or equivalent). Prose stays free of colons, semicolons and em-dashes (checklist rule 7).
4. `getDBChangesDiff.test.ts`, test `type checks mask paths against the schema`: give the seven calls a database that holds a change, so each resolves. Build `before` with `createMutableQuery(beforeDocs())` and `getDBSnapshot(query)`, then set `state.docs = afterDocs()`, as the first test in the file does. Keep every `@ts-expect-error` line and the `toHaveLength(7)` assertion. Do not replace the calls with `expectNoDBChanges`, because the test exists to type check `getDBChangesDiff`'s masks.
5. Add tests to `getDBChangesDiff.test.ts` (Verification lists them).
6. Commit with the message below. The footer is one line at column 0, followed by the attribution trailer:

   ```text
   Task 03_01: throw from getDBChangesDiff when nothing changed

   Key changes: <files and symbols>
   Deviations: <none or list>

   BREAKING CHANGE: getDBChangesDiff now throws when no document was added, removed or modified instead of returning an empty diff, so a test that diffs an unchanged database must call expectNoDBChanges instead.
   ```

## Gotchas

- `getDBChangesDiff` is `async`, so the throw becomes a rejected promise. Tests assert with `await expect(...).rejects`.
- A document whose data changed but whose `updateTime` did not is unmodified, so such a diff throws too. That matches `expectNoDBChanges`, which resolves in that case (`expectNoDBChanges.test.ts`, `resolves when data changed but updateTime did not`).
- The masks parameter has no effect on the check. Do not compare masked data.
- `formatDBChanges` stays unchanged. Its own tests may still format an empty `DBSnapshotChanges`.
- Do not change emulator tests. None diffs an unchanged database.
- `.mise/spec.md` may be modified in the working tree by the orchestrator. Do not stage it.

## Verification

Run from the repo root: `yarn format`, `yarn lint`, `yarn build`, `yarn test:unit`, and `yarn test:emulator` (the emulator tests call `getDBChangesDiff` and must stay green). Then `git log -1 --format=%B` shows the footer line intact.

Tests this task writes, in `packages/firebase-kit-admin/src/testing/getDBChangesDiff.test.ts`:

- `throws pointing at expectNoDBChanges when nothing changed`: same docs with the same `updateTimeMs` before and after. Assert the rejection with `toThrowErrorMatchingInlineSnapshot`, so the message text including `expectNoDBChanges` is pinned. Fails before this task because the call resolves to `"DB DIFF\n\n"`.
- `throws when only data changed and updateTime did not`: data differs, `updateTimeMs` equal. Assert `rejects.toThrow('expectNoDBChanges')`.
- `throws for an empty snapshot`: `createMutableQuery([])` and nothing added. Assert `rejects.toThrow('expectNoDBChanges')`.
- The rewritten `type checks mask paths against the schema` keeps passing, which is the check that it now diffs a changed database.

README and JSDoc have no test. They are prose only (no snippet changes), so the substitute check is reading them against the code.
