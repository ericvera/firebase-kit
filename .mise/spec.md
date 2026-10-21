# Spec: optional `details` for `checkDocumentExists`

## What

`checkDocumentExists(ref, auth, reader?, options?)` in `firebase-kit-admin/firestore` accepts an optional trailing `options: { details?: Record<string, unknown> }`. When the document is missing it throws `FunctionsInternalError` with the unchanged message `<collection> not found: <id>` and, when given, `options.details` as the error's `details`. Those details then appear in the `logger.error` call and in the callable client's error response. With `options` or `options.details` omitted, behavior is exactly as today (`details` is `undefined`).

## Design

- `packages/firebase-kit-admin/src/firestore/checkDocumentExists.ts`: add a fourth positional parameter `options?: CheckDocumentExistsOptions`, and forward `options?.details` as the third argument of `new FunctionsInternalError(auth, message, details)`. `FunctionsInternalError` → `FunctionsError` already forwards details to `HttpsError` and `logger.error`, so nothing else changes.
- Define the options type inline in the same file as `type CheckDocumentExistsOptions = { details?: Record<string, unknown> }`. Do not export it from `src/firestore/index.ts`; callers pass an object literal. No message prefix or override.
- Callers that want details without a reader pass `undefined` for `reader`.
- Release: this is an additive, non-breaking change, so the squashed commit is a `feat` with no `BREAKING CHANGE:` footer.
- README (`packages/firebase-kit-admin/README.md`): update the API entry signature (`:678`), extend the prose (`:247-248`) to say `options.details` is forwarded to the thrown error and so reaches both the logs and the callable's client (do not put secrets in it), and pass `{ details: ... }` in the `renameSpace` snippet (`:252-280`).
- Nothing is removed.

## Hard-to-undo

- Public API change: additive optional fourth parameter on the exported `checkDocumentExists` (`firebase-kit-admin/firestore`). Once published it can only be removed with a major release.

## Task index

| Task file | What it does | Files |
|---|---|---|
| `01_01_check-document-exists-details.md` | Add the `options.details` parameter, forward it to `FunctionsInternalError`, add emulator tests, update README | `packages/firebase-kit-admin/src/firestore/checkDocumentExists.ts`, `packages/firebase-kit-admin/README.md`, `packages/firebase-kit-admin/src/firestore/checkDocumentExists.emulator.test.ts` (test) |
