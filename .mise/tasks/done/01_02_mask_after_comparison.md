# 01_02 Label changed masked fields in the DB diff

## Goal

In `firebase-kit-admin/testing`, on a modified document, a masked field whose
value changed must print as a `-` / `+` pair: the before side carries the type
token with ` (before)` added inside it (`"/String (before)/"`) and the after side
the token with ` (after)` added (`"/String (after)/"`), likewise for every other
type token. A masked field that did not change, and every masked field of an
added or removed document, keeps the plain token (`"/String/"`). A document whose
only change is a masked field no longer prints an empty body. This is the new
default; there is no opt-in switch.

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/testing/internal/maskProps.ts` (modify: export `getTypeToken`, add an
  optional label)
- `src/testing/internal/maskModifiedProps.ts` (create)
- `src/testing/getDBChanges.ts` (modify)
- `README.md` (modify)

Tests (do not count): `src/testing/internal/maskModifiedProps.test.ts` (create),
`src/testing/internal/maskProps.test.ts`, `src/testing/getDBChanges.test.ts`,
`src/testing/getDBChangesDiff.test.ts`,
`src/testing/internal/DocumentChangeSnapshot.test.ts` (comment only).

## Background

- How it works today: `getDBChanges` (`src/testing/getDBChanges.ts:22-153`)
  normalizes each doc (`internal/normalizeData.ts:24-67` returns a fresh object;
  a Timestamp becomes the string `/Timestamp NNNN/`, indexed by its sorted
  position across both snapshots), then masks it with `maskProps`
  (`internal/maskProps.ts:24-50`), which replaces each masked top-level value
  **in place** with `getTypeToken(value)` (`internal/maskProps.ts:1-20`:
  `/Null/`, `/Array/`, `/String/`, `/Number/`, `/Boolean/`, `/Map/`; always one
  line). The after side is masked at `getDBChanges.ts:76-80`, before the
  added/modified decision; the before side of a doc present on both sides at
  `:105-109`; a removed doc at `:137-141`.
- Whether a doc is modified is decided by `updateTime` (`getDBChanges.ts:111`),
  not data. `ModifiedDocumentSnapshot.getDiff()`
  (`internal/DocumentChangeSnapshot.ts:188-190`) calls the module's `getDiff`
  (`:16-33`), plain jest-diff `diff` with color-less options and
  `contextLines: 0`, returning `undefined` on "no visual difference". So a masked
  value that changed but kept its type prints both sides as the same token: it is
  invisible, and a doc whose only change is masked prints a `MODIFIED` header
  with an empty body (`getDBChangesDiff.ts:41`).
- With distinct tokens on the two sides, plain jest-diff prints the `-` / `+`
  pair exactly as for any other changed field. `DocumentChangeSnapshot.ts` does
  not change.
- Design decisions (owner, `goals.md` `## Decisions`, "Task 4"):
  - New default, shipped as a regular feature, no switch.
  - The label depends only on whether the value changed, never on the value, so
    output is stable across runs for randomly generated values.
  - No special case for timestamps: a masked Timestamp that was rewritten
    (normalized index differs) shows as changed.
  - No new dependency (no `pretty-format`), no `diffLinesUnified2`, no editing
    of printed text.
  - Added/removed masked fields, and masked fields present on one side only,
    keep the plain token (they already print as `+` / `-`).

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `internal/maskProps.ts`: export `getTypeToken` and give it an optional
   second parameter `label?: 'before' | 'after'`. Build the token from the type
   name: `/${typeName}/` without a label, `/${typeName} (${label})/` with one
   (`/String (before)/`, `/Map (after)/`, `/Null (before)/`, ...). `maskProps`
   calls it without a label; its behavior and output do not change.

2. `internal/maskModifiedProps.ts`:

   ```ts
   export const maskModifiedProps = (
     before: unknown,
     after: unknown,
     collection: string,
     maskKeys: Record<string, string[]>,
   ): void
   ```

   Masks both values in place. If either value is not a non-null, non-array
   object, call `maskProps` on each and return. Otherwise, for each key in
   `maskKeys[collection] ?? []`: read both values; if both are not `undefined`
   and `!isDeepStrictEqual(beforeValue, afterValue)` (`node:util`), set
   `before[key] = getTypeToken(beforeValue, 'before')` and
   `after[key] = getTypeToken(afterValue, 'after')`; otherwise give each side
   whose value is not `undefined` the plain `getTypeToken(value)`. Compare
   **before** writing either side. JSDoc: why the label tracks only "changed",
   and why one-sided keys keep the plain token.

3. `getDBChanges.ts`, added/modified loop: stop masking the after side before
   the `isAdded` check. In the added branch, mask with `maskProps` as today. For
   a doc present on both sides, call
   `maskModifiedProps(beforeNormalizedData, afterNormalizedData, afterDoc.ref.parent.id, maskKeys)`
   in place of the two `maskProps` calls, then pass the (now masked) normalized
   values to `ModifiedDocumentSnapshot` as today. The unmodified path does not
   use the data; masking it or not makes no difference to output. Do not change
   the removed loop, the in-place sort, or any constructor signature.

4. `README.md` (admin), `### firebase-kit-admin/testing`, after the masks
   sentence near line 522: one sentence saying a masked field whose value
   changed still shows, as a `-` / `+` pair whose tokens read `(before)` and
   `(after)` (for example `"/String (before)/"` and `"/String (after)/"`), while
   an unchanged masked field keeps the plain token.

## Gotchas

- `maskProps` mutates its argument; compare the raw normalized values before any
  token is written. Do not change `maskProps`'s in-place behavior
  (`internal/maskProps.test.ts:68-77` pins it).
- A masked Timestamp field is already the string `/Timestamp NNNN/` when masked,
  so its token is `/String/`, and a rewritten one becomes
  `/String (before)/` / `/String (after)/`. That is intended (no timestamp
  special case); do not try to detect timestamps.
- A masked field whose type changed (string to number) is a changed value and
  prints `/String (before)/` / `/Number (after)/`; before this task it printed
  `/String/` / `/Number/`.
- The existing test "returns no diff for a modified document whose normalized
  data matches" (`internal/DocumentChangeSnapshot.test.ts:82-97`) stays green,
  but its comment says a masked change leaves nothing visible; reword it to say
  only that equal data yields no diff.
- Test file convention: `vi.mock` calls directly below imports, `vi.hoisted`
  above them, other declarations below.

## Verification

- Write `internal/maskModifiedProps.test.ts`: changed string gets
  `/String (before)/` and `/String (after)/`; equal values keep `/String/` on
  both; key on one side only keeps the plain token on that side and stays absent
  on the other; collection without masks leaves both untouched; deep-equal maps
  keep `/Map/`, differing maps get `/Map (before)/` / `/Map (after)/`; a type
  change gets `/String (before)/` / `/Number (after)/`; non-object values fall
  back to `maskProps`.
- Extend `internal/maskProps.test.ts`: `getTypeToken` with and without a label.
- Extend `getDBChanges.test.ts` (patterns at `:66-99`): modified doc with masked
  `secret` overwritten and `name` changed renders exactly

  ```
    Object {
  -   "name": "Draft",
  -   "secret": "/String (before)/",
  +   "name": "Final",
  +   "secret": "/String (after)/",
    }
  ```

  a doc whose only change is the masked field renders

  ```
    Object {
      "name": "Draft",
  -   "secret": "/String (before)/",
  +   "secret": "/String (after)/",
    }
  ```

  a masked field with an unchanged value on a modified doc stays a plain
  `"/String/"` context line; a masked Timestamp field rewritten between the
  snapshots prints the `(before)` / `(after)` pair; the existing added-doc mask
  test (`:66-99`) keeps its plain-token snapshot unchanged.
- Add one `getDBChangesDiff.test.ts` case pinning the full `DB DIFF` string for
  the masked-only change (no empty body).
- Run from `/Users/eric/Code/firebase-kit`: `yarn format`, `yarn lint`,
  `yarn build`, `yarn test:unit`, `yarn test:emulator` (existing emulator diffs
  use no masks and must stay unchanged).
