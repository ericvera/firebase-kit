# 01_01 — `checkDocumentExists` optional `details`

## Goal

Give `checkDocumentExists` in package `firebase-kit-admin` an optional trailing `options?: { details?: Record<string, unknown> }` argument. Forward `options.details` to the `FunctionsInternalError` it throws when the document is missing, so the logged error (and the callable client's error) carries caller-supplied context. Document it in the README.

## Files to modify/create

- `packages/firebase-kit-admin/src/firestore/checkDocumentExists.ts`
- `packages/firebase-kit-admin/README.md`
- (test) `packages/firebase-kit-admin/src/firestore/checkDocumentExists.emulator.test.ts`

## Background

- There are no prior tasks.
- Current function: `src/firestore/checkDocumentExists.ts:9-16` has the signature `(ref, auth, reader?: TransactionReader)`. It throws at `:25-28` with `new FunctionsInternalError(auth, \`${collectionName} not found: ${ref.id}\`)` and passes no details.
- `FunctionsInternalError(auth, message, details?: Record<string, unknown>)` (`src/errors/FunctionsInternalError.ts:5-11`) already forwards details to `HttpsError` (`src/errors/FunctionsError.ts:15`) and to `logger.error(msg, details)` (`src/errors/FunctionsError.ts:30`). No change is needed there.
- Test pattern for asserting details and the log call: `src/errors/FunctionsInternalError.test.ts:27-50`. It imports `logger` from `firebase-functions`, uses the bare `vi.mock('firebase-functions')` (the shim at `src/__mocks__/firebase-functions/index.ts` gives one shared `logger` spy), and asserts `error.details` and `vi.mocked(logger.error).mock.calls[0]` with inline snapshots. The log message format is `"[INTERNAL] <message> [UID: <uid>]"`.
- The existing emulator test (`src/firestore/checkDocumentExists.emulator.test.ts`) already has `vi.mock('firebase-functions')` at `:17`, with missing-doc cases at `:28-48` using `TestNonExistentID1` (message `spaces not found: missing-id-1`) and `authData` uid `test-uid`.
- Design decisions:
  1. The signature is `checkDocumentExists(ref, auth, reader?, options?)`. It is additive and non-breaking (ship as `feat`; no `BREAKING CHANGE:` footer). Do NOT turn `reader` into an options object.
  2. The message stays `<collection> not found: <id>`, with no prefix and no override. Context goes in `details` only.
  3. With `options`/`options.details` omitted, the error's `details` stays `undefined`, as today.
  4. Declare `type CheckDocumentExistsOptions = { details?: Record<string, unknown> }` in the same file. Do not add it to `src/firestore/index.ts`.
  5. Details reach the callable's client (firebase-functions passes `HttpsError` through unchanged). The README must say so and warn against putting secrets in it.
- README locations (`packages/firebase-kit-admin/README.md`): prose at `:247-248`, the `renameSpace` snippet at `:252-280`, and the API entry `checkDocumentExists(ref, auth, reader?)` at `:678`.

## Guides

None. The config has no Skills & guides section.

## Implementation details

1. In `checkDocumentExists.ts`, add `options?: CheckDocumentExistsOptions` after `reader`, and change the throw to `new FunctionsInternalError(auth, \`${collectionName} not found: ${ref.id}\`, options?.details)`. Extend the JSDoc to describe `options.details` (it is forwarded to the thrown error and reaches logs and the callable's client).
2. In the emulator test, add the new cases below the existing missing-doc cases (keep the imports, then `vi.hoisted`, then `vi.mock`, then other declarations order; add `import { logger } from 'firebase-functions'` to the imports):
   - Missing doc with `checkDocumentExists(docRef, authData, undefined, { details: { step: 'after-capture' } })`. Catch the error and assert the message snapshot is unchanged, `error.code === 'internal'`, the `error.details` inline snapshot, and that `logger.error` was called once with `["[INTERNAL] spaces not found: missing-id-1 [UID: test-uid]", { step: 'after-capture' }]`.
   - The same through a transaction reader (`checkDocumentExists(docRef, authData, reader, { details })`), asserting `error.details`.
   - Missing doc with no options: assert `error.details` is `undefined` and the `logger.error` second argument is `undefined`.
   - Existing doc with options passed: returns the data and does not call `logger.error`.
3. README:
   - Change `:678` to `checkDocumentExists(ref, auth, reader?, options?)`, and mention that `options.details` is attached to the thrown error.
   - Extend the prose at `:247-248`: the optional fourth argument `{ details }` is passed through to the `FunctionsInternalError`, so it appears in the log entry and in the error the callable's client receives. Do not put secrets in it. Pass `undefined` as `reader` when you need details outside a transaction.
   - In the `renameSpace` snippet, pass a fourth argument such as `{ details: { newName: name } }` to `checkDocumentExists`. The snippet must still compile as shown.

## Gotchas

- `mockReset: true` resets `logger.error` between tests, so `toHaveBeenCalledOnce()` is safe per test. Within one test, assert after exactly one throw.
- Inside `testDB.runTransaction`, Firestore may retry the callback on contention. With a missing doc and no writes it should throw once, but if the `logger.error` count proves flaky in the transaction case, assert only `error.details` there.
- Do not restate dependency version ranges in the README (CLAUDE.md doc conventions).
- Do not change `checkDocumentInQueryExists`.

## Verification

- Run `yarn format`, `yarn lint`, `yarn build`, `yarn test:unit` and `yarn test:emulator`. All must be green.
- New tests in `src/firestore/checkDocumentExists.emulator.test.ts`: details forwarded (direct read, including the `logger.error` call), details forwarded (transaction reader), no-options leaves `details` undefined, and existing doc with options returns data without logging.
- README snippet (consumer-facing wiring that the repo's tests cannot exercise): build, then `yarn pack` `firebase-kit-admin` (never `npm pack`) into a throwaway consumer project outside the repo. Extract the `src/spaces/renameSpace.ts` block verbatim, along with the minimal `db`/`spaceRefs` stubs it imports, and run `tsc --noEmit` on it. It must typecheck, with the 4-argument call resolving against the packed `.d.ts`.
