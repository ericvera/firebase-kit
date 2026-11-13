# 01_02 Compare masked fields before masking them in the DB diff

## Goal

In `firebase-kit-admin/testing`, a masked field whose value changed on a modified
document must print as a `-` / `+` pair of lines that both show the mask token,
and a document whose only change is a masked field must no longer print an empty
body. Every other diff stays byte-identical. This is the new default; there is no
opt-in switch.

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/testing/internal/getChangedMaskedKeys.ts` (create)
- `src/testing/getDBChanges.ts` (modify)
- `src/testing/internal/DocumentChangeSnapshot.ts` (modify)
- `package.json` (modify: add `pretty-format` to `dependencies`; `yarn install`
  updates the root `yarn.lock`)
- `README.md` (modify)

Tests (do not count): `src/testing/internal/getChangedMaskedKeys.test.ts`
(create), `src/testing/internal/DocumentChangeSnapshot.test.ts`,
`src/testing/getDBChanges.test.ts`, `src/testing/getDBChangesDiff.test.ts`.

## Background

- How it works today: `getDBChanges` (`src/testing/getDBChanges.ts:22-153`)
  normalizes each doc (`internal/normalizeData.ts` returns a fresh object),
  then masks it with `maskProps` (`internal/maskProps.ts:25-50`), which replaces
  each masked top-level value **in place** with a type token (`/String/`,
  `/Number/`, `/Boolean/`, `/Null/`, `/Array/`, `/Map/`, always one line).
  Note the after side is masked at `getDBChanges.ts:76-80`, before the
  added/modified decision, and the before side at `:105-109`.
- Whether a doc is modified is decided by `updateTime` (`getDBChanges.ts:111`),
  not data. `ModifiedDocumentSnapshot.getDiff()`
  (`internal/DocumentChangeSnapshot.ts:206-208`) calls the module's `getDiff`
  (`:17-33`), which runs jest-diff `diff` with color-less options and
  `contextLines: 0`, and returns `undefined` on "no visual difference". So a
  masked value that changed but kept its type is invisible, and a doc whose only
  change is masked prints a `MODIFIED` header with an empty body
  (`getDBChangesDiff.ts:41`).
- jest-diff's own object comparison (`/Users/eric/Code/firebase-kit/node_modules/jest-diff/build/index.js:1543-1555`)
  formats each value twice with pretty-format, `indent: 0` for comparing and
  default indent for display, and calls the exported
  `diffLinesUnified2(aDisplay, bDisplay, aCompare, bCompare, options)`. That
  function compares the compare lines and prints the display lines; it falls back
  to a plain display diff when line counts differ.
- `ModifiedDocumentSnapshot` is an exported **type** (`testing/index.ts:12`,
  `export type *`); only `getDBChanges` constructs it, so a new optional trailing
  constructor parameter is not a public API change.
- Design decisions:
  - Owner decision: the new behavior is the default, shipped as a regular
    feature. Consumer snapshots where a masked field was overwritten change once.
  - Approach: keep masking where it is; record which masked keys really changed;
    let the diff compare one rendering and display another. No rendered-text
    post-processing.
  - Added/removed masked fields already show as `+`/`-` with their token and are
    untouched.

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `package.json`: add `"pretty-format": "^30.5.1"` to `dependencies` (the
   version jest-diff 30.5.2 depends on, so no second copy is installed). Run
   `yarn install` from `/Users/eric/Code/firebase-kit`.

2. `internal/getChangedMaskedKeys.ts`:

   ```ts
   export const getChangedMaskedKeys = (
     before: unknown,
     after: unknown,
     collection: string,
     maskKeys: Record<string, string[]>,
   ): string[]
   ```

   Return `[]` unless both values are non-null, non-array objects. For each key in
   `maskKeys[collection] ?? []`, include it when both sides' values are not
   `undefined` and `!isDeepStrictEqual(beforeValue, afterValue)` (`node:util`).
   JSDoc: why keys present on only one side are excluded (they already render as
   `+`/`-`).

3. `getDBChanges.ts`, added/modified loop: restructure so that, for a doc present
   on both sides, `getChangedMaskedKeys(beforeNormalizedData, afterNormalizedData, afterDoc.ref.parent.id, maskKeys)`
   runs **before** either side is passed to `maskProps`. Simplest: move the
   `afterMaskedData` computation below the `isAdded` check (mask it inside the
   added branch and again in the modified path), or compute the before lookup
   first. Pass the keys to `ModifiedDocumentSnapshot` as a new last argument. Do
   not change unmodified, added or removed behavior or the in-place sort.

4. `internal/DocumentChangeSnapshot.ts`:
   - Hoist the options object `getDiff` passes to `diff` into a module constant
     (typed `DiffOptions` from jest-diff) and use it in both paths.
   - `ModifiedDocumentSnapshot` constructor: add
     `changedMaskedKeys: readonly string[] = []` as the last parameter; store it
     privately.
   - `getDiff()`: if `changedMaskedKeys` is empty, return
     `getDiff(before, after)` as today. Otherwise:
     - build `beforeCompare` / `afterCompare` as shallow copies of the masked
       objects where each changed key's value becomes
       `` `${String(value)}\u0000before` `` / `` `${String(value)}\u0000after` ``
       (the values are one-line token strings);
     - `aDisplay = format(before).split('\n')`, `aCompare = format(beforeCompare, { indent: 0 }).split('\n')`,
       same for after (import `format` from `pretty-format`);
     - return `diffLinesUnified2(aDisplay, bDisplay, aCompare, bCompare, options)`.
     Add a comment explaining why: the compare lines differ from the display lines
     only on masked keys whose raw values changed, so the change is detected while
     the content stays hidden.

5. `README.md` (admin), `### firebase-kit-admin/testing` section near line 525:
   one sentence after the masks sentence: a masked field still shows when its
   value changes, as a `-` / `+` pair that both print the type token.

## Gotchas

- `maskProps` mutates its argument; the raw normalized values are gone after it
  runs. Call `getChangedMaskedKeys` first. Do not change `maskProps` (its test
  pins the in-place behavior, `internal/maskProps.test.ts`).
- pretty-format's default options (`indent: 2`, `printBasicPrototype: true`,
  sorted keys) are what jest-diff uses for plain data, so display lines match
  today's `Object {` / `"key": value,` format. Confirm by the existing inline
  snapshots staying green.
- `diffLinesUnified2` requires equal display/compare line counts per side, which
  holds because only one-line string values differ between the two renderings.
- Existing test `DocumentChangeSnapshot.test.ts` "returns no diff for a modified
  document whose normalized data matches" stays green (no keys passed) but its
  comment says a masked change is invisible; reword it.
- Test file convention: `vi.mock` calls directly below imports, `vi.hoisted`
  above them, other declarations below.

## Verification

- Write `internal/getChangedMaskedKeys.test.ts`: changed string included;
  equal values excluded; key on one side only excluded; collection without masks
  returns `[]`; deep-equal maps excluded, differing maps included.
- Extend `getDBChanges.test.ts` (patterns at `:66-101`): modified doc with masked
  `secret` overwritten and `name` changed renders exactly

  ```
    Object {
  -   "name": "Draft",
  -   "secret": "/String/",
  +   "name": "Final",
  +   "secret": "/String/",
    }
  ```

  and a doc whose only change is the masked field renders

  ```
    Object {
      "name": "Draft",
  -   "secret": "/String/",
  +   "secret": "/String/",
    }
  ```

  plus a masked field with an unchanged value on a modified doc shows no `-`/`+`
  for it (today's output).
- Extend `DocumentChangeSnapshot.test.ts` with a direct
  `ModifiedDocumentSnapshot` case passing `changedMaskedKeys`.
- Add one `getDBChangesDiff.test.ts` case pinning the full `DB DIFF` string for
  the masked-only change (no empty body).
- Run from `/Users/eric/Code/firebase-kit`: `yarn format`, `yarn lint`,
  `yarn build`, `yarn test:unit`, `yarn test:emulator` (existing emulator diffs
  must stay unchanged).
