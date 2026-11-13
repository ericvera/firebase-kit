# 01_05 Document the vitest server.deps.inline requirement in both READMEs

## Goal

Close the two documentation gaps around vitest's `server.deps.inline`:

- The admin README states that its mocks only reach imports made inside
  `firebase-kit-admin` when the consumer inlines `firebase-kit-admin`.
- The client README gives the full set of reasons for inlining
  `firebase-kit-client`: its `firebase/functions` and `firebase/app` mocks, not
  only the `getsetdel` IndexedDB fake.

Docs only; no code changes.

## Files to modify/create

- `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/README.md` (modify)
- `/Users/eric/Code/firebase-kit/packages/firebase-kit-client/README.md` (modify)

## Background

- Why it exists: all three packages are `"type": "module"`; vitest leaves ESM
  packages in `node_modules` to plain Node by default, so a consumer's
  `vi.mock('<module>')` never reaches imports made inside the kit unless the kit
  package is listed in `test.server.deps.inline`.
- Admin imports a consumer's mock has to reach (none injected):
  `firebase-admin/functions` `getFunctions` (`src/tasks/createTaskEnqueuer.ts:1`);
  `firebase-functions` `logger` (`createTaskEnqueuer.ts:2`,
  `src/errors/FunctionsError.ts:1`, `src/errors/logInvalidRequest.ts:1`);
  `firebase-admin/app` (`src/createInit.ts:2`,
  `src/firestore/internal/createGetFirestore.ts:1-3`); `firebase-admin/auth`
  `getAuth` (`src/auth/checkClaimsVersion.ts:1`). The admin README's mocks
  section (`### firebase-kit-admin/mocks`, near lines 558-633) says the functions
  mock makes "the dedup path in `./tasks` testable" but never mentions `inline`.
- Client: the README block at `firebase-kit-client/README.md:111-137` already
  shows `server: { deps: { inline: ['getsetdel', 'firebase-kit-client'] } }` but
  explains it only through `getsetdel`/IndexedDB. The client's own imports of
  `firebase/functions` (`httpsCallable`, imported dynamically even when
  `functions` is injected, `src/callable/createActionableFunctionCaller.ts:49,56`),
  `firebase/app-check` `getToken` (`src/callable/internal/getTokenHeaders.ts:40`)
  and `firebase/app` / `firebase/firestore`
  (`src/firestore/internal/getHostingFirestore.ts:17-30`) are what the
  `firebase/functions` and `firebase/app` mocks in its `### firebase-kit-client/mocks`
  section (near lines 618-696) must reach.
- Owner decisions: the spike is closed as "leave it as documented"; nothing is
  built. `firebase-kit-protocol` has no runtime imports and must not be listed.
- CLAUDE.md documentation conventions: READMEs never restate a dependency's
  version range; every install command block shows npm and yarn (`# or`), prose
  stays package-manager neutral.

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. Admin README, `### firebase-kit-admin/mocks`: after the intro paragraph (or
   right after the first mock example), add a short paragraph and a
   `vitest.config.ts` block (header comment `// vitest.config.ts`) with
   `test: { server: { deps: { inline: ['firebase-kit-admin'] } } }`, explaining
   that a bare `vi.mock('firebase-admin/functions')` (or `firebase-admin/app`,
   `firebase-admin/auth`, `firebase-functions`) only intercepts the imports made
   inside `firebase-kit-admin` when vitest stops externalizing it, and what fails
   without it (the kit's own call goes to the real module, e.g. the enqueuer
   reaches the real `getFunctions`, so the dedup path is not exercised). Keep it
   consistent with the client README's wording. The block also sets
   `root: join(import.meta.dirname, 'src')` (with `import { join } from 'node:path'`),
   mirroring the client's block at `firebase-kit-client/README.md:116-132`
   including its comment: the admin README's shims live under `src/__mocks__/...`
   (`firebase-kit-admin/README.md:565,588,609`), and vitest resolves
   `__mocks__` relative to `root`, so without it a bare `vi.mock(...)`
   auto-mocks the real module (`firebase-kit-client/README.md:120-125`). Add no
   `setupFiles` entry: the only setup file the admin README shows
   (`src/__test__/setup/emulator.setup.ts`, `README.md:493`) belongs to the
   emulator suite, not to a suite using the mocks.
2. Client README, prose before and after the block at lines 111-137: state that
   inlining `firebase-kit-client` is also what lets the `firebase/functions` and
   `firebase/app` mocks from `### firebase-kit-client/mocks` reach the imports
   inside the package, not only the `getsetdel` chain. Optionally add a one-line
   pointer from the mocks section (near line 692) back to the config block.
3. Do not mention `firebase-kit-protocol` as needing inlining.

## Gotchas

- Keep every existing snippet byte-identical unless the change requires it.
- Run `yarn format` (prettier reflows Markdown).
- No version ranges in prose.

## Verification

No test covers README content. Substitute check, per the config's test
exceptions: `yarn pack` both packages (never `npm pack`) into a throwaway
consumer project outside the repo, install `vitest` and the peers, extract the
new admin `vitest.config.ts` block verbatim plus a minimal test that does
`vi.mock('firebase-admin/functions')` with the README's functions `__mocks__`
shim and calls `createTaskEnqueuer` twice with the same task id, and confirm it
passes with the inline entry and fails (reaches the real module) without it.
Then run from `/Users/eric/Code/firebase-kit`: `yarn format`, `yarn lint`,
`yarn build`.
