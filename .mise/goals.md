Look into the following task "[infra] support nested field paths in firebase-kit-admin db diff masks so tests can mask one unstable nested value". You are responsible for this repo so consider any instructions or implementation suggestions as just suggestions rather than goals or success criteria. Use it only to understand the problem.

## Task text (Todoist 6j2QvmQghMHfxv9m — context only, suggestions not criteria)

**Why:** `getDBChangesDiff` masks only reach top-level fields (the source says so: "Currently only works with props that exist in the top level of the object", `dist/testing/internal/maskProps.js`, true in 5.1.0 and 6.0.0). A test that needs to hide one unstable nested value has to either mask the whole top-level object, which hides the fields it exists to check, or wrap the document snapshots by hand.

**The case that needs it:** `functions/src/utils/callable/fast/handleUpdateOrderStatus.test.ts` (in the okven repo) has a local helper `maskTopUpRetryStartedAt` that swaps `quote.fees.topUpRetryStartedAt` for a marker before `getDBChanges`. Two tests use it. The value comes from a separate clock read than the status write, so under load the two land in different fake-clock steps and the timestamp numbering in the snapshot shifts.

**Why it matters for the 6.0.0 upgrade:** okven is on firebase-kit-admin 5.1.0. In 6.0.0 `getDBChanges` is no longer exported and `getDBChangesDiff(before, masks)` re-reads the documents itself, so the helper cannot work as written: the test never holds the after documents. With nested masks the helper becomes one mask entry, for example `{ [DBCollection.Order]: ['quote.fees.topUpRetryStartedAt'] }`.

**Done when:** a mask entry can name a nested path, it gets the same treatment as a top-level one (type token, before/after label when the value changed), and the okven helper is replaced by a mask entry during or before the 6.0.0 migration.

**Found on:** branch `feat/dev-speed`, review of the load-sensitive test fixes.

## Investigation

All paths under `packages/firebase-kit-admin/src/testing/` unless noted.

1. Not reproduced by running; clear from the code. A mask entry is only looked up as a top-level key (`obj[key]`) at `internal/maskProps.ts:60-67` and `internal/maskModifiedProps.ts:29-49`. A mask like `'meta.at'` reads as undefined and is skipped without error (`maskProps.ts:63-65`). The comment at `maskProps.ts:44-45` says "only works with props that exist in the top level". The only workaround today is masking the whole parent map, which prints `/Map/` (pinned in `internal/getDBChanges.test.ts:307-335`).
2. Symbols to change: `maskProps` (`internal/maskProps.ts:46`), `maskModifiedProps` (`internal/maskModifiedProps.ts:17`, `isDeepStrictEqual` on the value at line 36). Only call sites: `internal/getDBChanges.ts:63, 65, 70`. Public entry point: `getDBChangesDiff(before, masks?: Partial<Record<TCollection, string[]>>)` at `getDBChangesDiff.ts:16-19`. The `string[]` mask type is repeated at `internal/getDBChanges.ts:25` and `:32`.
3. Mutation risk: `internal/getDBChanges.ts:43-46` copies only the top level (`{ ...doc.data() }`), so nested masking in place would change the caller's nested objects. The existing guard test (`internal/getDBChanges.test.ts:337-349`) checks a top-level field only and would not catch it. Copy each nested map along the path before writing.
4. Ordering is already right: masking runs before timestamps are collected (`internal/getDBChanges.ts:59-78`) and `extractTimestamps` walks nested values, so a masked nested Timestamp stays out of the `/Timestamp NNNN/` numbering. `internal/getDBChanges.test.ts:273` and `:307` show the regression-test pattern.
5. Token rules to keep: `(before)`/`(after)` labels only when the value is present on both sides and changed (`maskModifiedProps.ts:33-41`); one side only gets a plain token (`:43-48`); either side not an object falls back to plain masking (`:23-27`). Type names come from `getTypeToken`/`getTypeName` (`maskProps.ts:4-42`); a Buffer prints as `String` for snapshot compatibility (`:9-13`).
6. Undecided by the code:
   - Path syntax. Firestore field names can contain `.`, and today a key like `'a.b'` matches a literal top-level field of that name. Plain dot-splitting changes what such masks match (see 9).
   - Arrays. `getTypeName` treats arrays as values (`maskProps.ts:19-21`); nothing traverses into elements.
   - Missing intermediate maps. The skip-if-undefined rule at `maskProps.ts:63` suggests skipping silently.
7. Collection keying is unaffected: masks are looked up by `doc.ref.parent.id` (`internal/getDBChanges.ts:60, 70`). `expectNoDBChanges` takes no masks and needs no change.
8. Tests (unit project only, no emulator): path resolution in `internal/maskProps.test.ts` (pattern `:20-110`); before/after labels in `internal/maskModifiedProps.test.ts` (`:7-95`); numbering and no-mutation in `internal/getDBChanges.test.ts` near `:307` and `:337`; end-to-end string in `getDBChangesDiff.test.ts:63` and `:131`, using `createDocSnapshot`/`createDBSnapshot` from `__test__/utils/`.
9. Hard to undo: `masks` is public API (`testing/index.ts:6`); the README documents masks as "per-collection field lists" at `packages/firebase-kit-admin/README.md:564-570`, API line at `:814` — both need updating. Under the CLAUDE.md release rule, changing what an existing mask string matches may need a `BREAKING CHANGE:` footer; a purely additive syntax publishes as a feat.
10. Nothing in the description conflicts with the code.

## Investigation: typed mask paths

Verified by type-checking scratch files with tsc against the installed firebase-admin 14.5.1 (@google-cloud/firestore 9.4.1).

1. The Firestore type is `UpdateData<T>`, exported from `firebase-admin/firestore` (`node_modules/firebase-admin/lib/firestore/index.d.ts:25`), defined at `node_modules/@google-cloud/firestore/types/firestore.d.ts:86-97`, nested keys built by `NestedUpdateFields`, `ChildUpdateFields`, `AddPrefixToKeys` (`:119-166`). `keyof UpdateData<Doc> & string` works as the mask entry type. The package already uses `UpdateData` in `packages/firebase-kit-admin/src/firestore/internal/TransactionWriter.ts:7,37`.
2. Accepted: top-level keys; dotted nested keys, including through optional maps and `T | null` maps; a whole array (`'items'`); a key literally named `'a.b'`; any child of an index-signature map (`'byId.x'`, `firestore.d.ts:162-165`).
3. Rejected: typos; array elements (`'items.0.sku'`, `'items.sku'`), because nesting only follows `Record<string, unknown>` (`:141-146`); the insides of a Timestamp (`'ts.seconds'`).
4. Interfaces stop the nesting. A nested map typed as an `interface` adds no dotted keys, because an interface does not satisfy `Record<string, unknown>` (`:143`). The top-level document may still be an interface. This package's own test types are interfaces (`src/__test__/db/types.ts:9,22,38`). okven's path is all type aliases (`OrderQuote`, `OrderQuoteFees`, `DBOrder = MakeDB<Order>`), so `'quote.fees.topUpRetryStartedAt'` compiles there.
5. `FieldPath` is never type checked: the class has no type parameter (`firestore.d.ts:3011-3018`) and `update()`'s field/value overload takes `string | FieldPath` and `any` (`:952-957`). Only the object form (`:927-931`) checks. Also: `keyof UpdateData<DocumentData>` accepts any string (index signature at `:39-41`), and a literal `'a.b'` key type-checks while runtime splitting treats it as nested.
6. No collection-to-document type mapping exists. `TCollection` is a string union of collection names (`src/testing/getDBChangesDiff.ts:16-19`, `src/testing/internal/getDBChanges.ts:22-25,32`). `CollectionDataPoint` picks the document type per call (`src/firestore/internal/createCollectionDataPoint.ts:7-9`), `DBSnapshot.docs` is untyped (`src/testing/getDBSnapshot.ts:16-21`), and there is no converter.
7. Signature change needed: the generic becomes a schema map, e.g. `TSchema extends Record<string, DocumentData>`, with masks typed `{ [C in keyof TSchema]?: (keyof UpdateData<TSchema[C]> & string)[] }`. The two `string[]` mask types at `internal/getDBChanges.ts:25` and `:32` change with it.
8. Release: breaking. Callers passing an explicit collection type argument (`getDBChangesDiff<DBCollection>(...)`) stop compiling. In this repo those are only internal tests (`src/testing/internal/getDBChanges.test.ts:85,116,143,168,196,240,285,317,342`). Callers without a type argument: `src/testing/getDBChangesDiff.test.ts:68-69`, `README.md:591`, `src/firestore/internal/createRunBatch.emulator.test.ts:34,73`, `createRunTransaction.emulator.test.ts:42`. JSDoc at `getDBChangesDiff.ts:12-14` and README `:564-570`, `:814` describe the old typing and need rewriting.
9. okven is still on the 5.x API (`getDBChangesDiff(getDBChanges(dataBefore, dataAfter))`), so it migrates to the new signature regardless.

## Decisions (owner)

- A mask entry addresses fields the way Firestore's `update()` addresses them. A string is a field path and is always split on dots, so `'quote.fees.topUpRetryStartedAt'` masks that one nested value.
- Hard requirement: every field passed in a mask is type checked against the collection's document type the same way Firestore validates the fields of `update()` when it is given a typed data class, so a mistyped field path fails to compile. Reuse Firestore's existing type for this rather than a hand-written path type.

- Release (owner: "definitely worth a major"): the change ships as a major. The type parameter changes from a collection-name union to a schema map, and a string mask for a literal dotted field name stops matching, so the squashed commit carries a `BREAKING CHANGE:` footer and all three packages take the next major.

- Document types are supplied as a schema type argument on each call: `getDBChangesDiff<DBSchema>(before, { orders: ['quote.fees.topUpRetryStartedAt'] })`, where `DBSchema` maps each collection name to its document type. One exported function, no factory.
- Passing masks without a schema does not compile. There is no unchecked mask path. Calls with no masks keep working without a type argument.

## Assumptions

- Following `update()`: a path walks maps only and cannot reach into array elements; an array is a value and can be masked whole.
- No `FieldPath` entries. Firestore never type checks a `FieldPath`, so accepting one would break the hard requirement. A field whose name contains a literal `.` cannot be masked on its own.
- Nested maps typed as a named `interface` produce no dotted keys, exactly as in `update()`. That is accepted as part of replicating Firestore. The repo lint rule `@typescript-eslint/consistent-type-definitions` rejects `type X = {…}` aliases, so documents and schemas are declared as `interface`s with each nested map written as an inline object type literal on its property, never as a named interface. The README caveat gives consumers the same advice.
- The pull request description repeats the `BREAKING CHANGE:` footer verbatim, so a hand-edited squash message keeps it.
- A path whose intermediate map is missing, or is not a map, is skipped silently, as a missing top-level field is today.
- A nested masked value gets the same treatment as a top-level one: type token, `(before)`/`(after)` labels only when present on both sides and changed.
- Masking never mutates the caller's documents, including nested maps.
- README mask documentation and the API line are updated in the same change.
- Out of scope: replacing the okven `maskTopUpRetryStartedAt` helper (another repo) and adding masks to `expectNoDBChanges`.

## Proposal

- Issue: `getDBChangesDiff` masks only match top-level fields, so one unstable nested value cannot be masked without hiding its whole parent map.
- Approach: masks become Firestore `update()`-style dotted paths, type checked per collection with `keyof UpdateData<Doc>` through a schema type argument that is required whenever masks are passed; shipped as a major with a `BREAKING CHANGE:` footer.
- Skips: none — public API change, so spec and critic both run.
