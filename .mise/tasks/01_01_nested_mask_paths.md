# 01_01 Nested mask paths at runtime

## Goal

Make every `getDBChangesDiff` mask entry resolve as a Firestore `update()`-style dotted field path, so `'meta.at'` masks only `meta.at` and leaves the rest of `meta` visible. A nested masked value gets the same type token, `(before)`/`(after)` labeling and exclusion from `/Timestamp NNNN/` numbering a top-level one gets today, and masking never mutates the caller's nested objects. Types are unchanged in this task (masks stay `string[]`). Task 01_02 adds the type checking.

## Files to modify/create

1. `packages/firebase-kit-admin/src/testing/internal/maskPath.ts` (new)
2. `packages/firebase-kit-admin/src/testing/internal/maskProps.ts`
3. `packages/firebase-kit-admin/src/testing/internal/maskModifiedProps.ts`
4. `packages/firebase-kit-admin/src/testing/internal/getDBChanges.ts` (comment only)

Tests: `internal/maskPath.test.ts` (new), `internal/maskProps.test.ts`, `internal/maskModifiedProps.test.ts`, `internal/getDBChanges.test.ts`, all under `packages/firebase-kit-admin/src/testing/`.

## Background

All paths below are under `packages/firebase-kit-admin/src/testing/`.

- `internal/maskProps.ts:46-72` `maskProps(a, collection, maskKeys)` masks in place by top-level key: `obj[key]` read at `:61`, skip when `undefined` at `:63-65`, `obj[key] = getTypeToken(value)` at `:67`. The note at `:44-45` says it only works for top-level props. `getTypeName`/`getTypeToken` (`:4-42`) produce the tokens and must not change (a Buffer prints `String` on purpose, `:9-13`).
- `internal/maskModifiedProps.ts:17-51` `maskModifiedProps(before, after, collection, maskKeys)`: falls back to `maskProps` on both sides when either is not a plain object (`:23-27`), labels `(before)`/`(after)` only when the value is present on both sides and not `isDeepStrictEqual` (`:33-41`), otherwise plain tokens per side (`:43-48`). It has a local `isPlainObject` at `:4-5`.
- `internal/getDBChanges.ts:41-48` copies each document's data only at the top level (`{ ...doc.data() }`) and then masks (`:59-71`) before collecting timestamps (`:73-78`). `extractTimestamps` walks nested values, so anything masked to a string takes no index.
- `__test__/utils/createDocSnapshot.ts` returns the `data` object by reference from `data()`, which is how the existing no-mutation test (`internal/getDBChanges.test.ts:337-349`) observes mutation.

Design decisions that reach this task (owner-approved, see `.mise/spec.md`):

- A mask string is always split on `.`. A literal top-level field whose name contains a `.` can no longer be masked on its own. That is accepted and released as breaking.
- A path walks plain maps only. It does not index into arrays, and does not enter Timestamps, Buffers, GeoPoints, DocumentReferences or any other class instance. An array or map at the end of a path is masked whole (`/Array/`, `/Map/`).
- A path whose intermediate is missing or not a map is skipped silently, as a missing top-level key is today.
- Masking never mutates caller data, nested maps included.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. Create `internal/maskPath.ts` exporting:
   - `isMap(value: unknown): value is Record<string, unknown>`. True only when `typeof value === 'object'`, not `null`, and `Object.getPrototypeOf(value)` is `Object.prototype` or `null`. This excludes arrays, Timestamps, Buffers and other Firestore value classes in one check.
   - `readPath(data: Record<string, unknown>, path: string): unknown`. Split on `.`, walk from `data`. Before descending into each segment except the last, the current value must satisfy `isMap`, otherwise return `undefined`. Return the leaf value (may be `undefined`).
   - `writePath(data: Record<string, unknown>, path: string, value: unknown): void`. Split on `.`. For each intermediate segment, take `parent[seg]`, set `parent[seg] = { ...child }`, and continue from the copy. Then assign the leaf on the last parent. Document in a short comment that intermediates are copied because the top-level copy in `getDBChanges` is shallow and `data()` may return the caller's objects, and that callers call it only after `readPath` returned a defined value.
2. `internal/maskProps.ts`: replace `obj[key]` with `readPath(obj, key)` and the assignment with `writePath(obj, key, getTypeToken(value))`. Remove the top-level-only note at `:44-45` (replace with a one-line comment saying entries are dotted paths, if useful). Keep the signature and the early return for non-objects.
3. `internal/maskModifiedProps.ts`: replace `before[key]`/`after[key]` reads with `readPath` and writes with `writePath`. Replace the local `isPlainObject` with `isMap` from `./maskPath.js` for the fallback check. Keep every token rule. Update the JSDoc so "key" reads "path" where it describes a mask entry.
4. `internal/getDBChanges.ts`: update the Step 1 comment (`:41-42`) to say masking copies nested maps along a masked path itself, so the shallow copy here is enough. No logic change.

## Gotchas

- Do not deep-clone whole documents in `getDBChanges`. Only maps along a masked path get copied, so unmasked values (including Timestamps that feed numbering and equality) are untouched.
- `writePath` must copy before writing even when two mask paths share a parent. Copying an already-copied map again is harmless.
- `isDeepStrictEqual` in `maskModifiedProps` must still compare raw values, so read both sides before writing either side.
- Overlapping entries such as `['meta', 'meta.at']` need no special handling. Once `meta` is a string token, `readPath` for `meta.at` hits a non-map and skips.
- Existing inline snapshots must stay byte-identical. Only new tests add new snapshots.
- Test file conventions (CLAUDE.md): `vi.mock` calls directly below imports, `vi.hoisted` above them, everything else below. These tests need no mocks.
- Comment prose: no colons, semicolons or em-dashes inside comment sentences (`.claude/mise-checklist.md` rule 7).

## Verification

Run from the repo root: `yarn format`, `yarn lint`, `yarn build`, `yarn test:unit`, `yarn test:emulator` (getDBChanges backs the emulator suites' diffs).

Tests this task writes (all under `packages/firebase-kit-admin/src/testing/internal/`):

- `maskPath.test.ts` (new): `readPath` returns a top-level value, a nested value, `undefined` for a missing intermediate, `undefined` when an intermediate is an array, a Timestamp, a Buffer or a string; `writePath` writes a nested leaf and leaves the original nested object unchanged (assert the original nested map is still `toBe` the same reference with its old value, and the written map is a different reference); `isMap` true for `{}` and `Object.create(null)`, false for arrays, `null`, `Timestamp`, `Buffer`.
- `maskProps.test.ts`: a nested path masks only the leaf and keeps siblings (`{ meta: { at: ts, keep: 'x' } }` with `'meta.at'` gives `{ meta: { at: '/Timestamp/', keep: 'x' } }`); a path through a missing map or through an array is skipped; a path ending on an array masks it as `/Array/`; a dotted string no longer matches a literal top-level `'a.b'` key (the field passes through unmasked).
- `maskModifiedProps.test.ts`: a nested value changed on both sides gets `(before)`/`(after)` labels; unchanged nested value gets plain tokens; nested value present on one side only (intermediate map missing on the other) gets a plain token on that side.
- `getDBChanges.test.ts`, next to `:307` and `:337`: a nested masked Timestamp stays out of numbering while a sibling and a top-level Timestamp are numbered from `0000` (inline snapshot showing the parent map with the masked leaf token); a nested mask does not mutate the caller's nested object (keep a reference to the nested map and its Timestamp, run `getDBChanges` with `entries: ['meta.at']`, assert `data.meta.at` is still the original Timestamp).

Each new behavior test must fail on the pre-change code (checklist rule 5).
