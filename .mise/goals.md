[feat] add an optional details argument to checkdocumentexists so a missing-document error carries its context.

Description:

The problem: checkDocumentExists(ref, auth, reader) in firebase-kit-admin throws FunctionsInternalError("<collection> not found: <id>") with no details. When the read happens after a side effect, such as the pickup reading the customer after a Stripe capture, the logged error doesn't say what had already happened.
The change: add an optional details (and maybe a message prefix) argument that gets passed through to the FunctionsInternalError it throws.

## Investigation

- **Target:** `checkDocumentExists(ref, auth, reader?)` is at `packages/firebase-kit-admin/src/firestore/checkDocumentExists.ts:9-16`. It throws at `:25-28` with the message `${ref.parent.id} not found: ${ref.id}` and passes no details.
- **Pass-through is already there:** `FunctionsInternalError(auth, message, details?: Record<string, unknown>)` at `packages/firebase-kit-admin/src/errors/FunctionsInternalError.ts:5-11` forwards details. `FunctionsError` then passes them to `HttpsError` (`src/errors/FunctionsError.ts:15`) and to `logger.error(msg, details)` (`src/errors/FunctionsError.ts:30`). So the change only needs to add the parameter and forward it.
- **Details reach the client:** because details go to `HttpsError` (`FunctionsError.ts:15`), a callable's caller receives them as well as the logs.
- **Pattern:** sibling `checkDocumentInQueryExists` takes one options object (`src/firestore/checkDocumentInQueryExists.ts:6-11`, `:30-31`) with message overrides `errorIfEmpty`/`errorIfMultiple` that replace the message rather than prefix it. It passes no details either (`:42`, `:50`). `checkDocumentExists` uses positional args; an optional trailing param is additive (minor `feat`). Turning `reader` into an options object would be breaking.
- **Public API:** exported from `firebase-kit-admin/firestore` (`src/firestore/index.ts:1`).
- **Callers:** none inside the repo besides the emulator test and README.
- **Tests:** regression test goes in `src/firestore/checkDocumentExists.emulator.test.ts` (missing-doc cases at `:28-48`, mocks `firebase-functions` at `:17`). Assert `error.details` and the `logger.error` call as `src/errors/FunctionsInternalError.test.ts:35-42` does. Run `yarn test:emulator`.
- **Docs:** README signature at `packages/firebase-kit-admin/README.md:678`, prose at `:247-248`, snippet at `:252-280`. Errors entry at `:663` already documents `details?`.
- **Client exposure verified (firebase-functions 7.4.0):** FunctionsInternalError is an `HttpsError` with code `internal`; the onCall catch passes any `instanceof HttpsError` through unchanged and responds `{error:{details, message, status:"INTERNAL"}}` (`lib/esm/common/providers/https.mjs:114,565,570`). Only non-HttpsError throws are replaced with a generic `INTERNAL` with no details (`https.mjs:565-567`). So the original message and details do reach the callable's client.

## Open questions

1. Argument shape: 4th positional `details`, or a trailing options object `{ details?, message? }`?
2. Message prefix: none, a prefix, or a full-message override?
3. Client exposure of details: document the warning only, or keep details out of the HttpsError?
