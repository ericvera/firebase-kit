# 02_01 — `checkDocumentInQueryExists` optional `details`

## Goal

Give `checkDocumentInQueryExists` in package `firebase-kit-admin` an optional `details?: Record<string, unknown>` field on its existing options object, and forward it to both `FunctionsInternalError` throws: the multiple-matches throw and the empty-result throw that happens when `errorIfEmpty` is set. Messages stay unchanged. Add emulator tests and update the README to match `checkDocumentExists`. This gives parity with `checkDocumentExists` for lookups that run after a side effect.

## Files to modify/create

- `packages/firebase-kit-admin/src/firestore/checkDocumentInQueryExists.ts`
- `packages/firebase-kit-admin/README.md`
- (test) `packages/firebase-kit-admin/src/firestore/checkDocumentInQueryExists.emulator.test.ts`

## Background

- Prior task 01_01 (done) added `options?: { details? }` as the fourth argument of `checkDocumentExists` (`src/firestore/checkDocumentExists.ts`) and forwarded `options?.details` to `new FunctionsInternalError(auth, message, details)`. Copy its style.
- Current function: in `src/firestore/checkDocumentInQueryExists.ts`, the `interface CheckDocumentInQueryExistsOptions` at `:6-11` has the fields `auth`, `reader?`, `errorIfEmpty?` and `errorIfMultiple?`. The JSDoc is at `:18-23`. The function generic is `Options extends CheckDocumentInQueryExistsOptions` (`:27-28`). The two throws are at `:42` (`new FunctionsInternalError(options.auth, errorMessage)`, multiple matches) and `:50` (`new FunctionsInternalError(options.auth, options.errorIfEmpty)`, empty).
- `FunctionsInternalError(auth, message, details?: Record<string, unknown>)` (`src/errors/FunctionsInternalError.ts:5-11`) already forwards details to `HttpsError` and to `logger.error(msg, details)`. The log message format is `"[INTERNAL] <message> [UID: <uid>]"`.
- Details reach the callable's client, because firebase-functions passes an `HttpsError` through unchanged.
- Test pattern to mirror: `src/firestore/checkDocumentExists.emulator.test.ts`.
  - Imports `logger` from `firebase-functions` (`:1`) and `type HttpsError` from `firebase-functions/https` (`:2`).
  - Defines a `captureError` helper (`:23-29`).
  - Has a details test with a direct read (`:60-85`), a details test through a transaction reader (`:87-103`), a no-options test that leaves details undefined (`:105-113`), and a success-with-options test with no logging (`:115-127`).
- The existing query test file `src/firestore/checkDocumentInQueryExists.emulator.test.ts` follows this order: imports, then `vi.hoisted` at `:14-16`, then `vi.mock('firebase-functions')` at `:18`, then `authData` and `beforeEach`. It uses `personRefs.personByHandleQuery(handle)` and `addPersonToDB(now, { id, handle, displayName })` with `TestPersonID1`/`TestPersonID2` to create duplicates (`:42-63`). Each test uses a unique handle.
- Design decisions:
  1. `details` goes on the existing options interface. Do not add a new parameter. This is additive and non-breaking, so it ships as a `feat` with no `BREAKING CHANGE:` footer.
  2. Messages are unchanged. Context goes in `details` only.
  3. When the query is empty and `errorIfEmpty` is not given, the function still returns `undefined` and ignores `details`.
  4. When `details` is omitted, the error's `details` stays `undefined`, as today.
  5. The README must say that details reach the callable's client and must warn against putting secrets in them.
- README locations (`packages/firebase-kit-admin/README.md`):
  - The prose for `checkDocumentInQueryExists` is at `:285-288`.
  - The `checkDocumentExists` prose about details at `:247-252` is the wording to match.
  - The API entry `checkDocumentInQueryExists(query, options)` is at `:685-686`.

## Guides

None. The config has no Skills & guides section.

## Implementation details

1. In `checkDocumentInQueryExists.ts`:
   - Add `details?: Record<string, unknown>` to `CheckDocumentInQueryExistsOptions`.
   - Pass `options.details` as the third argument to both `FunctionsInternalError` throws.
   - Extend the JSDoc to say that `details` is attached to either thrown error and reaches both the logs and the callable's client.
   - Leave the result-type generic unchanged.
2. In the emulator test:
   - Add `import { logger } from 'firebase-functions'` and `import type { HttpsError } from 'firebase-functions/https'` to the imports.
   - Add a `captureError` helper below `authData`, the same as in `checkDocumentExists.emulator.test.ts:23-29`.
   - Keep the order: imports, then `vi.hoisted`, then `vi.mock`, then other declarations.
   - Add these cases, each with a unique handle:
     - Multiple matches with `{ auth, details: { step: 'after-capture' } }`. Assert the message snapshot is unchanged (`Expected at most 1 document in query, found 2`), `error.code === 'internal'`, and the `error.details` inline snapshot. Assert `logger.error` was called once, with `["[INTERNAL] Expected at most 1 document in query, found 2 [UID: test-uid]", { step: 'after-capture' }]`.
     - Multiple matches through a transaction reader with `details`. Assert `error.details`.
     - Empty query with `errorIfEmpty` and `details`. Assert the custom message, `error.details`, and the `logger.error` call.
     - Empty query with `errorIfEmpty` and no `details`. Assert that `error.details` and the `logger.error` second argument are `undefined`.
     - Empty query with `details` but no `errorIfEmpty`. It resolves to `undefined` and `logger.error` is not called.
     - Exactly one match with `details`. It returns the data and `logger.error` is not called.
3. README:
   - Extend the `checkDocumentInQueryExists` prose (`:285-288`). Say that its options also accept `details`, which is passed through to the `FunctionsInternalError` on either throw, so it appears in the log entry and in the error the callable's client receives. Say never to put secrets in it.
   - Update the API entry at `:685-686` to mention that `options.details` is attached to the thrown error.
   - Do not add a new snippet.

## Gotchas

- `mockReset: true` resets `logger.error` between tests, so `toHaveBeenCalledOnce()` is safe within a single test.
- `testDB.runTransaction` may retry the callback. If the `logger.error` count is flaky in the transaction case, assert only `error.details` there, as 01_01 does.
- Duplicate handles across tests can collide if the emulator is not cleared between tests. Use a fresh handle per test, as the existing tests do.
- Do not restate dependency version ranges in the README (CLAUDE.md documentation conventions).
- Do not change `checkDocumentExists` or `src/firestore/index.ts`. The interface stays unexported.

## Verification

- Run `yarn format`, `yarn lint`, `yarn build`, `yarn test:unit` and `yarn test:emulator`. All must pass.
- New tests in `src/firestore/checkDocumentInQueryExists.emulator.test.ts`:
  - details forwarded on multiple matches (direct read, including the `logger.error` call)
  - details forwarded on multiple matches (transaction reader)
  - details forwarded on empty with `errorIfEmpty`
  - no details leaves `details` undefined
  - details without `errorIfEmpty` on an empty query returns `undefined` and does not log
  - a single match with details returns the data and does not log
- README: the change is prose only, with no new or changed snippet, so no `yarn pack` consumer check is needed. Confirm that the wording matches the `checkDocumentExists` paragraph and that no version range appears.
