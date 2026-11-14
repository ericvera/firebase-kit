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

## Open questions

1. Path syntax for a nested mask entry.
2. Whether a path may reach into array elements.
