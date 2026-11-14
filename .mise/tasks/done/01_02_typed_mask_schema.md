# 01_02 Type-checked mask paths through a schema type argument

## Goal

Make every `getDBChangesDiff` mask entry type checked against its collection's document type with Firestore's own `UpdateData<T>`, supplied through a schema type argument: `getDBChangesDiff<DBSchema>(before, { orders: ['quote.fees.topUpRetryStartedAt'] })`. A mistyped path, an array-element path, an unknown collection, or masks passed without a schema fail to compile. Calls without masks keep compiling without a type argument. Update the README to match.

## Files to modify/create

1. `packages/firebase-kit-admin/src/testing/getDBChangesDiff.ts`
2. `packages/firebase-kit-admin/src/testing/internal/getDBChanges.ts`
3. `packages/firebase-kit-admin/src/testing/internal/maskProps.ts` (parameter type only)
4. `packages/firebase-kit-admin/src/testing/internal/maskModifiedProps.ts` (parameter type only)
5. `packages/firebase-kit-admin/README.md`

Tests: `packages/firebase-kit-admin/src/testing/getDBChangesDiff.test.ts`, `packages/firebase-kit-admin/src/testing/internal/getDBChanges.test.ts`.

## Background

All source paths below are under `packages/firebase-kit-admin/src/testing/`.

- Task 01_01 made masks runtime dotted paths: `internal/maskPath.ts` (`isMap`, `readPath`, `writePath`) is used by `maskProps` (`internal/maskProps.ts`) and `maskModifiedProps` (`internal/maskModifiedProps.ts`). Both still take `maskKeys: Record<string, string[]>`.
- `getDBChangesDiff.ts:16-23` today: `<TCollection extends string = string>(before: DBSnapshot, masks?: Partial<Record<TCollection, string[]>>)`. JSDoc at `:12-14` describes keying by a collection enum.
- `internal/getDBChanges.ts:22-32` has the same `TCollection` generic and casts masks to `Record<string, string[]>` at `:32`.
- Explicit type arguments to internal `getDBChanges` appear only in `internal/getDBChanges.test.ts` (`getDBChanges<Collection>` at lines 85, 116, 143, 168, 196, 240, 285, 317, 342, plus any added by 01_01). The `type Collection` alias at `:7` goes away with them.
- Callers without masks, which must keep compiling unchanged: `getDBChangesDiff.test.ts` (several), `src/firestore/internal/createRunBatch.emulator.test.ts:34,73`, `src/firestore/internal/createRunTransaction.emulator.test.ts:42`, `expectNoDBChanges.ts:15` (internal `getDBChanges` without masks).
- Callers with masks: `getDBChangesDiff.test.ts:68-69` (`const masks = { spaces: ['updated'] }`, which widens to `string[]` and so needs a `DBMasks<Schema>` annotation), `:146-155` (`diffWith(masks?: { spaces: string[] })`) and its call `diffWith({ spaces: ['at'] })` at `:156`, README `:591`.
- `UpdateData` is exported from `firebase-admin/firestore` and already used in `src/firestore/internal/TransactionWriter.ts:7,37`.
- README sections: masks paragraph `packages/firebase-kit-admin/README.md:564-570`, emulator test example `:573-609`, testing API line `:814-815`. The `DBSpace` interface and `Collection` enum used by the README example come from the `src/spaces/spaceRefs.ts` and `src/firebase/db.ts` snippets at `:187-235`.

Design decisions that reach this task (owner-approved, see `.mise/spec.md`):

- Reuse Firestore's `UpdateData<T>` rather than a hand-written path type.
- The schema is a type argument on each call, mapping collection name to document type. One exported function, no factory.
- Masks without a schema do not compile. No `FieldPath` entries.
- Nested maps typed as a named `interface` produce no dotted keys, exactly as with `update()`. Accepted and documented. The repo lint rule `@typescript-eslint/consistent-type-definitions` (default `interface` option, active on test files) rejects `type X = {...}` aliases, so documents and schemas are declared as `interface`s with each nested map written as an inline object type literal on its property, never as a named interface.
- Shipped as a major. The release version is computed from commit footers only (CLAUDE.md "Releasing"), and the repository squashes with `squash_merge_commit_message: COMMIT_MESSAGES`, so the default squash body is the branch's commit messages joined together. This task's commit carries the `BREAKING CHANGE:` footer (step 5 of Implementation details). Earlier squash commits on main (`cc759b5`, `cf90d38`) have hand-written bodies, so the merger may rewrite the squash message. The pull request description must therefore repeat the footer verbatim, taking it from this task's commit body via `git log` (recorded in `.mise/spec.md` `## Hard-to-undo`). This task does not open the PR. The README must not describe the old typing.

## Guides

none (the mise config has no Skills & guides entries)

## Implementation details

1. `getDBChangesDiff.ts`:

   ```ts
   import type { DocumentData, UpdateData } from 'firebase-admin/firestore'

   export type DBMasks<TSchema> = {
     [C in keyof TSchema & string]?: readonly (keyof UpdateData<TSchema[C]> & string)[]
   }

   export const getDBChangesDiff = async <
     TSchema extends { [C in keyof TSchema]: DocumentData } = never,
   >(
     before: DBSnapshot,
     masks?: NoInfer<[TSchema] extends [never] ? undefined : DBMasks<TSchema>>,
   ): Promise<string>
   ```

   The planner type-checked this exact shape against the installed firebase-admin with strict settings: interface schemas and interface top-level documents compile, `'quote.fees.at'` through a `{...} | null` map compiles, `'items'` (whole array) compiles, typos, `'items.0.sku'`, unknown collections and schema-less masks are rejected, and a `DBMasks<S>` value is assignable to `Partial<Record<string, readonly string[]>>` without a cast. Rewrite the JSDoc: masks are per-collection Firestore `update()`-style field paths, always split on dots, type checked against `TSchema` via `UpdateData`, required schema when masks are passed, and the interface caveat. Give `DBMasks` its own JSDoc.
2. `internal/getDBChanges.ts`: drop the `TCollection` generic. `masks?: Partial<Record<string, readonly string[]>>`. Replace the cast and its comment at `:30-32` with `const maskKeys = masks ?? {}` (or equivalent) and adjust types so it passes to `maskProps`/`maskModifiedProps` without a cast.
3. `internal/maskProps.ts` and `internal/maskModifiedProps.ts`: widen `maskKeys` to `Partial<Record<string, readonly string[]>>` (the existing `keys` undefined check and `?? []` already handle a missing collection). No behavior change.
4. `README.md`:
   - Masks paragraph: masks are keyed by collection and list Firestore `update()`-style field paths, so `'quote.fees.at'` masks one nested value. Pass a schema type argument mapping each collection to its document type, and every path is checked with Firestore's `UpdateData`, so a typo fails to compile. Masks without a schema do not compile, while a call with no masks needs no type argument. A path cannot reach into array elements (mask the array whole) and a nested map typed as a named `interface` adds no dotted paths, the same as `update()`. Advise declaring the document as an `interface` with each nested map written as an inline object type literal on its property, for example `interface DBOrder { quote: { fees: { at: Timestamp } } }`. A field whose own name contains a `.` cannot be masked on its own. Keep the existing sentences on `(before)`/`(after)` tokens, Timestamp tokens and numbering, extended to say nested masked values behave the same.
   - Example: define the schema next to the test as an `interface` and pass it, for example `interface DBSchema { [Collection.Spaces]: DBSpace }` and `getDBChangesDiff<DBSchema>(before, { [Collection.Spaces]: ['updated'] })`, importing `Collection` and `DBSpace` from the earlier snippets' modules. Pick whatever keying matches how the earlier snippets define `Collection` and make sure the block type-checks.
   - API line: `getDBChangesDiff<TSchema>(before, masks?)` with a short note that `masks` is a `DBMasks<TSchema>`. Add `DBMasks<TSchema>` as its own entry if the section lists types.
   - Never restate dependency version ranges. Keep install blocks untouched.
5. Commit message: this is an explicit addition to the implementer's usual commit body, and it overrides the usual two-line body rule for this commit only. Keep the usual subject (`Task 01_02: ...`) and the usual `Key changes:` and `Deviations:` lines. After those two lines, add a blank line and then the `BREAKING CHANGE:` footer as its own paragraph, then a blank line and the `Co-Authored-By:` trailer last. The message shape is:

   ```text
   Task 01_02: <summary>

   Key changes: <...>
   Deviations: <...>

   BREAKING CHANGE: <footer line below>

   Co-Authored-By: <trailer>
   ```

   The footer is exactly one line (no wrapping), because text follows it in the squash body and a multi-line footer would pull that text into the release note. Use this text (wording may be tightened, it must stay one line, and the three breaks may not be dropped):

   ```text
   BREAKING CHANGE: getDBChangesDiff in firebase-kit-admin/testing now takes a schema map type argument instead of a collection-name union, masks passed without a schema type argument no longer compile, and a dotted mask string such as 'a.b' now addresses nested field b inside map a instead of a top-level field named 'a.b'.
   ```

   `!` after the type is optional and not enough on its own. If the wording is tightened, update the copy in `.mise/spec.md` `## Hard-to-undo` to the exact text before committing, so it lands in the same commit. The pull request description later takes the footer from this commit's body via `git log`, because `.mise/` is removed before the pull request is written.

## Gotchas

- `NoInfer` matters. Without it TypeScript can infer `TSchema` from the masks literal and the schema-less error disappears. Keep the `[TSchema] extends [never]` brackets so the conditional does not distribute.
- `exactOptionalPropertyTypes` is on (`@tsconfig/strictest`). Passing an explicit `undefined` for `masks` from a helper must still compile. Check the `diffWith` helper in `getDBChangesDiff.test.ts`.
- `keyof UpdateData<DocumentData>` accepts any string. Test schemas must use concrete document types, or the negative type tests prove nothing.
- A nested map typed as a named interface adds no dotted keys. `yarn lint` and the pre-commit lint reject `type X = {...}` aliases (`@typescript-eslint/consistent-type-definitions`). Declare the local test documents and the schema as `interface`s, and write each nested map as an inline object type literal on its property (`interface Space { meta: { at: Timestamp; keep: string } | null }`). Never move a nested map into a named `interface Meta`, which silently removes the dotted keys and makes the `'meta.at'` positive case fail to compile. Do not change `src/__test__/db/types.ts`.
- `@ts-expect-error` lines are checked by `tsc --build` because test files are in `src` (`packages/firebase-kit-admin/tsconfig.json` includes `src`). Each one must sit directly on the line that errors.
- Test file conventions (CLAUDE.md): `vi.mock` directly below imports, `vi.hoisted` above them, every other declaration below.
- Comment and README prose: no colons, semicolons or em-dashes inside sentences (`.claude/mise-checklist.md` rule 7), except a colon introducing a code block or list.

## Verification

Run from the repo root: `yarn format`, `yarn lint`, `yarn build`, `yarn test:unit`, `yarn test:emulator` (the emulator suites call `getDBChangesDiff` and must keep compiling and passing).

Tests this task writes or changes:

- `packages/firebase-kit-admin/src/testing/getDBChangesDiff.test.ts`:
  - Define a local schema as interfaces with inline nested maps, for example `interface Space { name: string; at: Timestamp; updated: string; meta: { at: Timestamp; keep: string } | null; tags: string[] }` and `interface Schema { spaces: Space }`. `at` must be present because the existing `diffWith({ spaces: ['at'] })` call at `:156` masks it.
  - Update the existing masked calls to pass `<Schema>`. Annotate `const masks: DBMasks<Schema> = { spaces: ['updated'] }` at `:68` (without it the literal widens to `string[]` and does not match). Type `diffWith`'s parameter as `DBMasks<Schema>`.
  - Type tests with `@ts-expect-error` (each must be needed): a typo path, `'tags.0'`, a path into a Timestamp (`'meta.at.seconds'`), an unknown collection key, and masks passed with no type argument. Positive cases that must compile: `'meta.at'`, `'tags'`, `'at'`, and a call with no masks and no type argument.
  - End-to-end: a nested Timestamp masked with `'meta.at'` on a modified document prints `/Timestamp (before)/`/`/Timestamp (after)/` inside `meta`, keeps `keep` visible, and another Timestamp numbers from `0000` (inline snapshot of the full DB DIFF string, pattern at `:131-184`).
- `packages/firebase-kit-admin/src/testing/internal/getDBChanges.test.ts`: remove the `type Collection` alias and every `<Collection>` type argument. Inline snapshots stay unchanged.

Substitute check for the release footer (no test covers commit messages): after committing, run `git log -1 --format=%B` and confirm the footer is its own single-line paragraph placed after the `Key changes:` / `Deviations:` lines and before the `Co-Authored-By:` trailer, that it starts `BREAKING CHANGE:`, that it names the schema-map type parameter, schema-less masks no longer compiling, and dotted strings addressing nested fields, and that it matches the copy in `.mise/spec.md` `## Hard-to-undo` exactly. Do not amend or add a commit to record this. Report the check result in your final report.

Substitute check for the README (no repo test can import it, per the config's Test exceptions): `yarn pack` the `firebase-kit-admin` and `firebase-kit-protocol` workspaces (never `npm pack`), install the tarballs in a throwaway consumer project outside the repo, extract the README's `src/firebase/db.ts`, `src/spaces/spaceRefs.ts`, `src/spaces/renameSpace.ts` and `src/spaces/renameSpace.emulator.test.ts` blocks verbatim to the paths in their header comments, and run `tsc --noEmit`. It must pass. Then change the example's mask to a misspelled path and confirm `tsc` fails, then revert. Record the result in the task's progress notes.

## Progress notes

- README check: `yarn pack` of `firebase-kit-admin` and `firebase-kit-protocol` installed in a throwaway consumer (strictest tsconfig, nodenext). The README's `src/firebase/db.ts`, `src/spaces/spaceRefs.ts`, `src/spaces/renameSpace.ts` and `src/spaces/renameSpace.emulator.test.ts` blocks, extracted verbatim, pass `tsc --noEmit`. Changing the example mask to `'updatd'` fails with TS2820, and reverting passes again.
