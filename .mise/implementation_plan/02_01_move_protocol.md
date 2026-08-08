# Task 2.1: Move `firebase-kit-protocol` and build the real quality commands

## Goal

Replace the `firebase-kit-protocol` placeholder with its real source, and replace
the phase-1 stub build/test scripts with the real per-package orchestration that
the two remaining packages will plug into.

## Requirements addressed

REQ-REPO-1, REQ-REPO-3, REQ-QUAL-1, REQ-QUAL-2, REQ-QUAL-3, REQ-QUAL-3c,
REQ-QUAL-3d, REQ-QUAL-3f, REQ-QUAL-5, REQ-QUAL-5a, REQ-QUAL-6b

## Background

**Do not start this task until the maintainer has confirmed that all three
placeholders are published to npm and all three trusted publishers are
configured.** Task 1.4 ended at that hard stop.

**Work on the mise feature branch** (`feat/publish-firebase-kit-packages`), which
task 1.4 rebased onto `main`. Phase 1 is done and on `main`.

The source is `/Users/eric/Code/okven/packages/firebase-kit-protocol`. **Copy it;
never modify the Okven original.** Okven is entirely out of scope for this work
and must keep building.

`firebase-kit-protocol` is the smallest of the three: 133 lines across exactly
three files in `src/` with no subdirectories — `index.ts`, `constants.ts`,
`types.ts`. It has **no dependencies and no tests**. Its `package.json` in Okven
has a stub `ci:test` script that just echoes that there are no tests.

Both other packages depend on it, through a `workspace:` dependency and a
TypeScript project reference, so nothing else can build until it lands.

What phase 1 left in place that this task changes:
- `packages/firebase-kit-protocol/` holds only a placeholder `package.json` and
  README.
- Root `tsconfig.json` is solution-style with an **empty** `references` array.
- Root `test`, `test:unit`, and `test:emulator` are stubs that echo and exit 0.

## Files to modify/create

- `packages/firebase-kit-protocol/src/` — copied from Okven (3 files)
- `packages/firebase-kit-protocol/tsconfig.json` — copied, with one change
- `packages/firebase-kit-protocol/package.json` — real manifest replacing the
  placeholder
- `tsconfig.json` — add the first project reference
- `package.json` — replace the stub test scripts with real orchestration

## Implementation details

1. **Copy the source.** Bring `src/` across verbatim — all three files, no edits.

2. **Copy `tsconfig.json`, changing one setting.** Okven's version extends
   `@tsconfig/strictest`, sets `composite`, `incremental`, `rootDir: src`,
   `outDir: dist`, `module`/`moduleResolution` `NodeNext`, target `ESNext`,
   `include: ["src"]`, and `references: []`.

   Change **`removeComments` from `true` to `false`.** All three Okven packages
   strip comments, which would ship `.d.ts` files with no doc comments and break
   consumer intellisense. The template repository sets it to `false` with a
   comment explaining exactly that; match the template, not Okven. Carry that
   explanatory comment over.

3. **Write the real `package.json`,** replacing the placeholder. Keep the name and
   `0.0.1` version (task 3.4 does not change versions either — the release
   workflow sets them). Carry over from Okven: `type: module`, the string-form
   `exports` pointing at the built index, `files`, `sideEffects: false`,
   `engines.node >= 24`, and public access.

   Give it `build` and `lint` scripts. **Do not give it a `test` script** — it has
   no tests, and step 5 depends on it being absent rather than stubbed.

   Task 3.1 adds description, keywords, and `repository.directory`; task 2.4
   audits dependencies. Do not pre-empt either.

4. **Add the project reference.** Add `./packages/firebase-kit-protocol` to the
   root `tsconfig.json` `references` array. This is what makes `yarn build`
   compile it, and what lets the typed lint rules resolve its types from the
   other packages later.

5. **Replace the stub test scripts with real per-package orchestration.** This is
   the structurally important part of the task.

   The root test commands must invoke the test runner **once per package**, not
   once across the whole workspace. The reason: the runner evaluates "no tests
   ran" once per run, so a single workspace-spanning run in which one package
   contributes zero test files and another contributes many still exits 0. Once
   `firebase-kit-client` is added in task 2.2, that shape would silently lose its
   entire 149-test suite to a config mistake and still report success.

   Build the commands so that:
   - `test:unit` runs the unit tests of every package that has them, one
     invocation per package.
   - `test:emulator` runs the emulator tests of every package that has them, one
     invocation per package.
   - `test` runs both.
   - `firebase-kit-protocol` is covered by **neither**, because it declares no
     test script — not because a tolerance flag excuses it.

   **Do not enable a repository-wide "pass with no tests" setting.** If one was
   introduced in phase 1 to make the empty skeleton green, remove it now. Leaving
   it would mask exactly the misconfiguration this structure exists to catch.

   With only `protocol` present, both commands legitimately have no package to
   run. Make that case exit 0 — it is the last moment it will be true, since task
   2.2 adds the first real suite.

6. **Ensure tests build first.** Every test command must build, or otherwise
   guarantee build output exists, before running. Tests in the other two packages
   import `firebase-kit-protocol` by package name, which resolves through its
   `exports` into `dist/` — on a clean checkout with no build, that resolution
   fails. Okven's own test scripts are all prefixed with a build for this reason.

## Testing suggestions

`firebase-kit-protocol` has no tests and the project's Out of Scope explicitly
allows it to stay that way — do not add any. Per the project's test exception for
library packages with no e2e infrastructure, verify structurally instead:

- `yarn build` produces `packages/firebase-kit-protocol/dist/` containing
  `index.js`, `constants.js`, `types.js` and their `.d.ts` siblings.
- Open one generated `.d.ts` and confirm doc comments survived — this is the
  observable check for the `removeComments` change.
- `yarn lint` is clean across the repository.
- `yarn test`, `yarn test:unit`, `yarn test:emulator` all exit 0.
- From a scratch directory, import the built package by path and confirm the
  exported constants and types resolve.

## Gotchas

- **`removeComments: true` is the easy thing to copy and the wrong thing.** It is
  the single consumer-visible regression this task can silently introduce, and
  nothing in the build or tests catches it — only reading a `.d.ts` does.
- **Do not give protocol a stub `test` script.** An echoing stub makes it look
  covered and defeats the structural exclusion in step 5.
- **The root `references` array is order-insensitive but existence-sensitive.** A
  reference to a directory without a `tsconfig.json` fails the build with TS6053.
- **`workspace:` dependencies are not involved yet.** Protocol depends on nothing.
  Tasks 2.2 and 2.3 add the dependency edges pointing at it.
- **A workspace-spanning single test run is the natural thing to write and is
  wrong here.** If the orchestration ends up as one command over all packages,
  re-read step 5.

## Verification checklist

- [ ] Maintainer confirmation of published placeholders and configured trusted
      publishers was received before this task started
- [ ] `packages/firebase-kit-protocol/src/` matches the Okven source byte for byte
- [ ] The Okven repository is unmodified
- [ ] `removeComments` is `false`; a generated `.d.ts` visibly retains doc comments
- [ ] Root `tsconfig.json` references the package; `yarn build` emits `dist/`
- [ ] The package has `build` and `lint` scripts and **no** `test` script
- [ ] Root test commands invoke the runner once per package, not once globally
- [ ] No repository-wide "pass with no tests" setting remains anywhere
- [ ] Test commands build before running
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test`, `yarn test:unit`,
      `yarn test:emulator` all pass
- [ ] End-to-end tests: none — the project's test exception for library packages
      with no e2e infrastructure applies; substitute verification is the build
      output inspection, the `.d.ts` comment check, and the scratch-directory
      import above
