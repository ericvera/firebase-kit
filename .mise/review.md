# Review

Range: `origin/main...HEAD`, all under `packages/`. The release is breaking: the squashed commit needs one `BREAKING CHANGE:` footer naming every item marked **breaking** below (major on all three packages).

## Tasks

- **01_01** (`c3ac45e`) — `getDocumentsFromQuery(query, reader?)` and `getDocuments(refs, reader?)` added to `firebase-kit-admin/firestore`; typed `{ id, ...data }`, `undefined` in the position of a missing document. Verify: `yarn test:emulator`, the README usage snippet.
- **01_02** (`f06b5d3`) — a masked field whose value changed prints `"/String (before)/"` and `"/String (after)/"`; unchanged masked fields print as before. Verify: `yarn test:unit`, pinned output in `src/testing/internal/getDBChanges.test.ts`.
- **01_03** (`5b68afe`) — superseded by 03_01 and 03_02: `getDBDiffSince` and the hidden refs map never ship.
- **01_04** (`a663c08`) — superseded by 02_01 and 04_01.
- **01_05** (`14a5104`) — docs only: both READMEs explain the vitest `root` and `server.deps.inline` settings. Verify: read both sections.
- **02_01** (`8b05ef5`) — **breaking**: `EnqueueTaskOptions.taskName` removed. Verify: `yarn build` (a `@ts-expect-error` test rejects `taskName`), `yarn test:unit`.
- **03_01** (`3bedec8`) — **breaking**: `getDBSnapshot` returns `DBSnapshot` (`{ docs, refs }`) instead of an array; the module-level map is deleted. Verify: `yarn test:unit`, `src/testing/getDBSnapshot.ts`.
- **03_02** (`b62c015`) — **breaking**: the public diff API is `getDBChangesDiff(before, masks?)` and `expectNoDBChanges(before)`; `getDBChanges` and the changes-object types are internal. Verify: `yarn test:unit`, `yarn test:emulator`, `src/testing/index.ts`.
- **03_03** (`f87ed8b`) — **breaking output**: masked fields are left out of the `/Timestamp NNNN/` numbering, and a masked Timestamp prints `"/Timestamp/"` (was `"/String/"`). Verify: `yarn test:unit`, `src/testing/internal/getDBChanges.test.ts`.
- **03_04** (`9a1786b`) — docs only: the admin README documents the two-call API. Verify: read the testing section and its example.
- **04_01** (`49fdab0`) — **breaking**: task data is typed `TData extends { action: string }`; the log label is `data.action`; `getAction` and the `unnamed` fallback are gone. Verify: `yarn build`, `yarn test:unit`.
- **05_01** (`617d437`) — the DB diff normalizes document paths at any depth; the 4-segment limit is gone and a missing ancestor is named in the error. Not breaking: 2- and 4-segment paths print as before. Verify: `yarn test:unit`, `src/testing/internal/DocumentChangeSnapshot.test.ts`.
- **Review fixes** — `a0c6adf` assigns awaited helper results to a variable before asserting (README, emulator tests, unit tests); `cc2f0c0` makes the enqueue function reject with `FunctionsInternalError` when `data.action` is not a string, before the emulator check; `1d41961` removes mid-sentence semicolons from prose this branch wrote.

Every code task ran `yarn lint`, `yarn build` and `yarn test:unit`; `yarn test:emulator` last ran after 03_03, and only docs and `src/tasks` changed after it. README snippets were type-checked in a throwaway project built from `yarn pack`. A full run without `-u` after the review fixes passed (admin 57 files / 271 unit tests, client 33 / 240, 39 emulator tests, no snapshot written), and 05_01 passed all four commands after it. Every review round (the original 24 files, the 26 changed by the amendments, the 2 changed by 05_01) returned no blocking finding.

## Open assumptions

- `getDocumentsFromQuery`, `getDocuments` and the `DBSnapshot` type name are the planner's proposals; `getDBChangesDiff` and `expectNoDBChanges` are the owner's.
- `expectNoDBChanges` takes no masks, and a rewrite with identical data counts as modified (the document's update time changed).
- The consuming app must migrate before it can take this version: about 2,150 `getDBSnapshot` sites are unaffected, 661 diff sites and 411 `expectNoDBChanges` sites change their arguments, 13 sites read `.docs`, its `omitServerStamps` sites switch to masks, and seven `taskName` lines go. That work is outside this repo.
- The owner’s dependency update (dev dependencies and Yarn 4.18.1) is committed on this branch as `c46864c`, so it ships inside the same squashed commit. Runtime and peer ranges are unchanged, and every test run since the update used it.
- The spike is closed with no code.

## Left unfixed

- 10 older mid-sentence semicolons in README prose this branch did not write (4 admin, 4 client, 2 protocol); the owner has not said whether to fix them here.
- Minor, first review round: `packages/firebase-kit-client/README.md` says "its cached reads import `getApp` from `firebase/app`"; every Firestore read does.
- Found by the 01_05 implementer: the admin README never says the functions mock needs `resetFunctionsMock` in `beforeEach`.
- Minor, amendment critic: 03_03's "Timestamp inside a masked map" test only proves the change if the masked timestamp is the earlier one; the implementer reported the two numbering tests failing before the change, but this one was not separately confirmed.

## Amendments

All dated 2026-11-13, decided by the owner at review; full text under `## Amendments` in spec.md.

1. `taskName` removed outright; the release becomes breaking (02_01).
2. `getDBSnapshot` returns an object carrying its refs; no module-level state (03_01).
3. Two-call diff API, `getDBChanges` internal, masked fields out of the timestamp numbering, masked Timestamp prints `/Timestamp/` (03_02 to 03_04).
4. Task data must be `{ action: string }` (04_01).
5. Diff paths at any depth (05_01); not breaking.
