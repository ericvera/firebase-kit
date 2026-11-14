# Review

## Tasks

- 01_01 (30ed90d) — mask entries resolve as dotted paths at runtime. New `packages/firebase-kit-admin/src/testing/internal/maskPath.ts` (`isMap`, `readPath`, `writePath`); `maskProps` and `maskModifiedProps` read and write through it, copying each map along the path so caller data is never mutated. Verify: `yarn test:unit`; read the nested cases in `internal/maskPath.test.ts`, `internal/maskProps.test.ts`, `internal/maskModifiedProps.test.ts` and the nested numbering and no-mutation tests in `internal/getDBChanges.test.ts`.
- 01_02 (d1e0adb) — `getDBChangesDiff<TSchema>` plus exported `DBMasks<TSchema>`, paths checked with `keyof UpdateData<Doc>`; masks without a schema do not compile; internal `getDBChanges` loses its `TCollection` generic; README masks paragraph, example and API lines rewritten. Verify: the `@ts-expect-error` cases and the `'meta.at'` snapshot in `packages/firebase-kit-admin/src/testing/getDBChangesDiff.test.ts`; `yarn lint && yarn build && yarn test`; README section "masks" in `packages/firebase-kit-admin/README.md`.

## Open assumptions

- No `FieldPath` entries: a field whose name contains a literal `.` cannot be masked on its own.
- A nested map declared as a named `interface` gets no dotted keys (Firestore's own behavior); documents are interfaces with nested maps written inline. The README says so.
- Paths walk maps only; an array is masked whole. A path through a missing map, or a non-map, is skipped silently.
- `maskModifiedProps` falls back to plain masking on both sides when either side is a class instance rather than a plain map.
- `readPath` does not check that the root object is a map, keeping the old top-level behavior for any object `maskProps` accepts.
- Two new tests (skip on missing map or array, nested no-mutation) also pass on the old code; they are regression guards.
- Release: the `BREAKING CHANGE:` footer is on the 01_02 commit and is repeated verbatim in the pull request description. Text that follows the footer in the squash body leaks into the release note unless the footer is the last paragraph of the squash message at merge.
- Out of scope: replacing the okven `maskTopUpRetryStartedAt` helper; masks on `expectNoDBChanges`.

## Amendments

None.
