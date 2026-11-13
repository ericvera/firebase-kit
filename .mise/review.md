# Review

Range: `origin/main...HEAD` — 24 files, all under `packages/`.

## Tasks

- **01_01** (`c3ac45e`) — `getDocumentsFromQuery(query, reader?)` and `getDocuments(refs, reader?)` added to `firebase-kit-admin/firestore`; both return typed `{ id, ...data }`, and `getDocuments` returns `undefined` in the position of a missing document. Verify: `yarn test:emulator` (`getDocumentsFromQuery.emulator.test.ts`, `getDocuments.emulator.test.ts`), and the new README usage snippet.
- **01_02** (`f06b5d3`) — in a modified document, a masked field whose value changed prints `"/String (before)/"` and `"/String (after)/"`; unchanged masked fields and added or removed documents print as before. Verify: `yarn test:unit`, and read the pinned output in `src/testing/getDBChangesDiff.test.ts` and `src/testing/getDBChanges.test.ts`.
- **01_03** (`5b68afe`) — `getDBDiffSince(before, masks?)` added to `firebase-kit-admin/testing`; `getDBSnapshot` remembers its refs in a hidden side table, signature unchanged. Verify: `yarn test:unit` (`getDBDiffSince.test.ts`, `getDBSnapshot.test.ts`), and the README emulator example, which now uses it.
- **01_04** (`a663c08`) — `EnqueueTaskOptions.taskName` is optional and `@deprecated`; the log label is `taskName`, else `data.action`, else `unnamed`. Verify: `yarn test:unit` (`createTaskEnqueuer.test.ts`), and the README tasks example.
- **01_05** (`14a5104`) — docs only: the admin README states the vitest `root` and `server.deps.inline` settings its mocks need; the client README says the `firebase-kit-client` entry also serves the `firebase/functions` and `firebase/app` mocks. Verify: read both sections.

Each task's implementer ran `yarn format`, `yarn lint` and `yarn build`. `yarn test:unit` last ran after 01_04, `yarn test:emulator` after 01_03; nothing after those points touched code they cover. README snippets were type-checked in a throwaway project built from `yarn pack`. The review round (two reviewers over the 24 files) returned no blocking finding.

## Open assumptions

- The public names are the planner's proposals, not the owner's pick: `getDocumentsFromQuery`, `getDocuments`, `getDBDiffSince`.
- A `taskName` that is passed wins over `data.action`, so existing callers' log lines do not change. The generic label is `unnamed`.
- "Additive" is slightly too strong for `taskName`: code that reads it from an `EnqueueTaskOptions` value now gets `string | undefined`, and a deprecation error under a strict lint config. Passing it is unaffected.
- A masked Timestamp that is rewritten shows as changed, like any other masked field. The owner confirmed this, since they rarely mask timestamps.
- A copy of a snapshot (`slice`, spread, `filter`) has no remembered refs, so `getDBDiffSince` throws on it.
- The release is one squashed `feat:` commit with no `BREAKING CHANGE:` footer.
- The follow-up edits in the consuming app are out of scope.
- The spike is closed with no code; only the two README gaps were fixed.

## Left unfixed

- Minor, from the review round: `packages/firebase-kit-client/README.md:143` says "its cached reads import `getApp` from `firebase/app`"; every Firestore read does, cached or not.
- Found by the 01_05 implementer, outside its task: the admin README never says the functions mock needs `resetFunctionsMock` in `beforeEach` before its queue spies do anything.

## Amendments

None.
