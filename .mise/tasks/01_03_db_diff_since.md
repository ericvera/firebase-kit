# 01_03 getDBDiffSince: one call for the after snapshot and the diff

## Goal

Add `getDBDiffSince(before, masks?)` to `firebase-kit-admin/testing`. It takes the
after snapshot itself from the refs the `before` snapshot was taken from, and
returns the printable `DB DIFF` string, so an emulator test reads:

```ts
const before = await getDBSnapshot(refs)

await renameSpace(undefined, 'space-1', 'Renamed')

expect(await getDBDiffSince(before, { spaces: ['updated'] })).toMatchInlineSnapshot()
```

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/testing/internal/snapshotInputs.ts` (create)
- `src/testing/getDBSnapshot.ts` (modify)
- `src/testing/getDBDiffSince.ts` (create)
- `src/testing/index.ts` (modify)
- `README.md` (modify)

Tests (do not count): `src/testing/getDBDiffSince.test.ts` (create),
`src/testing/getDBSnapshot.test.ts`.

## Background

- `getDBSnapshot(inputs)` (`src/testing/getDBSnapshot.ts:23-35`) accepts a
  `SnapshotInput` (a `TestableDBRef` with `testAllQuery()` or a bare `Query`) or
  an array of them, and returns a bare `Promise<QueryDocumentSnapshot[]>`. It
  does not carry its refs today.
- `getDBChanges(before, after, masks?)` (`src/testing/getDBChanges.ts:22`) sorts
  both arrays **in place** (identity survives, pinned by
  `getDBChanges.test.ts:143`). `getDBChangesDiff(changes)`
  (`src/testing/getDBChangesDiff.ts:10`) renders the string.
- `getDBSnapshot.test.ts:64` asserts `toEqual([])`; enumerable properties on the
  returned array would break `toEqual`/`toStrictEqual`.
- Owner decisions:
  - Keep `getDBSnapshot` for the before snapshot; one new call replaces the
    after/changes/diff lines. The code under test stays a plain statement
    between them (no callback).
  - The snapshot remembers its refs in a hidden side table keyed by the returned
    array. A snapshot with no record (a copy made with `slice`, spread or
    `filter`) makes the new call throw a clear error.
  - No existing signature or exported type changes; the three existing functions
    stay exported. The README example moves to the new call.
- Unit-test pattern for mocked queries: `getDBSnapshot.test.ts:6-15`
  (`createQuery(paths)` built on `src/__test__/utils/createDocSnapshot.ts`, which
  accepts `updateTimeMs`).

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `internal/snapshotInputs.ts`:

   ```ts
   const inputsBySnapshot = new WeakMap<QueryDocumentSnapshot[], SnapshotInput[]>()
   export const registerSnapshotInputs = (docs: QueryDocumentSnapshot[], inputs: SnapshotInput[]): void
   export const getSnapshotInputs = (docs: QueryDocumentSnapshot[]): SnapshotInput[] | undefined
   ```

   Import `SnapshotInput` as a type from `../getDBSnapshot.js` (type-only import,
   no runtime cycle). Comment: why a WeakMap (invisible to iteration, spread,
   JSON and equality; garbage-collected with the array).

2. `getDBSnapshot.ts`: build the flat array into a `const docs`, call
   `registerSnapshotInputs(docs, inputArray)`, return `docs`. Update the JSDoc to
   mention `getDBDiffSince`. Signature unchanged.

3. `getDBDiffSince.ts`:

   ```ts
   export const getDBDiffSince = async <TCollection extends string = string>(
     before: QueryDocumentSnapshot[],
     masks?: Partial<Record<TCollection, string[]>>,
   ): Promise<string>
   ```

   - `const inputs = getSnapshotInputs(before)`; if `undefined`, throw
     `new Error('getDBDiffSince needs the array getDBSnapshot returned; a copy made with slice, spread or filter does not carry the refs it was taken from')`.
   - `const after = await getDBSnapshot(inputs)`, then
     `return getDBChangesDiff(getDBChanges(before, after, masks))`.
   - JSDoc: the before/run/after pattern, that `before` must be the array
     `getDBSnapshot` returned, that masks behave as in `getDBChanges`.

4. `testing/index.ts`: add `export * from './getDBDiffSince.js'` in alphabetical
   order. Do not export `snapshotInputs`.

5. `README.md` (admin):
   - Replace the example at `### firebase-kit-admin/testing` (near lines 527-550,
     `src/spaces/renameSpace.emulator.test.ts`) with the `getDBDiffSince` form;
     adjust the lead-in prose (masks now passed to `getDBDiffSince`) and mention
     that `getDBSnapshot`, `getDBChanges` and `getDBChangesDiff` remain for a test
     that needs the changes object, and that `before` must be the array
     `getDBSnapshot` returned.
   - API Reference `### firebase-kit-admin/testing` (near line 728): add a
     `getDBDiffSince(before, masks?)` bullet.
   - If task 01_02 already added a sentence about masked changes there, keep it.

## Gotchas

- Store the normalized `inputArray` (always an array), not the raw `inputs`.
- The after snapshot `getDBDiffSince` takes is itself registered; harmless.
- Calling `getDBDiffSince(before)` twice must work (in-place sort keeps
  identity).
- Do not change `getDBChanges` or `getDBChangesDiff`.
- Test file convention: `vi.mock` calls directly below imports, `vi.hoisted`
  above them, other declarations below.

## Verification

- Write `src/testing/getDBDiffSince.test.ts` (unit, mocked queries whose `get`
  returns different docs on successive calls, e.g. a `let docs` the test
  reassigns between calls): it returns the same string as the three-step form
  for an added, a modified (different `updateTimeMs`) and a removed doc; it
  passes masks through; it throws the error above for `[...before]`,
  `before.slice()` and a hand-built array; it re-reads every input (refs object
  and bare query).
- Extend `getDBSnapshot.test.ts`: the returned array still `toEqual`s a plain
  array of the same docs and has no extra own enumerable keys
  (`Object.keys(docs)` is only indices).
- Run from `/Users/eric/Code/firebase-kit`: `yarn format`, `yarn lint`,
  `yarn build`, `yarn test:unit`, `yarn test:emulator`.
- README snippet: per the config's test exceptions, `yarn pack` the admin package
  into a throwaway consumer project outside the repo and type-check the
  replaced example verbatim (extracted to its header path, with the `db.ts`,
  `spaceRefs.ts` and `renameSpace.ts` blocks it imports).
