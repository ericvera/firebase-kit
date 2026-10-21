# Review

## Tasks

- 01_01 (commit 2714141): `checkDocumentExists(ref, auth, reader?, options?)` forwards `options?.details` to the `FunctionsInternalError` it throws, and the message is unchanged. It adds 4 emulator tests (details on a direct read with the `logger.error` call, details through a transaction reader, no options leaves details undefined, and an existing doc with options). The README prose, `renameSpace` snippet and API line are updated, with a warning that details reach the callable's client. Verify with `yarn test:emulator`. The README snippet was typechecked against a `yarn pack` tarball.
- 02_01 (commit 14cbc05, amendment): `checkDocumentInQueryExists` options gain `details?`, forwarded to both errors (multiple matches; empty with `errorIfEmpty`). Messages unchanged. 6 new emulator tests; README prose and API entry updated with the same client/secrets note. Verify: `yarn test:emulator`.

## Open assumptions

- When options or details are omitted, the error carries no details, as before.
- Any caller that needs details without a transaction passes `undefined` for `reader`.
- The options type is an unexported `interface CheckDocumentExistsOptions`. The task asked for a `type`, but lint rule `consistent-type-definitions` requires an interface.
- Release: a squashed `feat:` commit with no `BREAKING CHANGE:` footer, which publishes as a minor release.

## Amendments

- 2026-10-21 Extended scope to `checkDocumentInQueryExists` for parity (owner chose after the parity sweep) — task 02_01.
