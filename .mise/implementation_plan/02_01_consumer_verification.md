# Task 2.1: Verify the new peer set from a packed consumer

## Goal

Prove that the upgraded packages actually install and work for a real consumer:
pack all three workspaces, install them into a throwaway project outside the
repo alongside the new peer set, and run the documented README snippets verbatim.

This is the substitute verification the config's **Test exceptions** entry
requires. It is the only check in this plan that exercises the published wiring —
the `exports` maps, the `peerDependencies` ranges, and the README instructions —
because the repo's own tests import source directly and structurally cannot.

## Requirements addressed

`goals.md` → "Verification (decision 3a)", item 2 (the matched *consumer-facing
wiring* Test exception).

## Background

`firebase-kit` is a Yarn 4 monorepo (`packageManager: yarn@4.18.0`) publishing
three packages from `packages/`: `firebase-kit-protocol`, `firebase-kit-client`,
and `firebase-kit-admin`. Both dependents declare `firebase-kit-protocol` as
`"firebase-kit-protocol": "workspace:*"` in their `dependencies`.

**Tasks 1.1 through 1.5 already landed**, and the repo's own suite is green.
Between them they changed exactly the things a consumer sees:

- **Task 1.1** moved in-range floors, including two peer ranges: `firebase`
  `^12.17.1` (client) and `firebase-functions` `^7.3.2` (admin).
- **Task 1.2** **merged `firestore-snapshot-utils` into `firebase-kit-admin`** —
  it is no longer a peer at all, `jest-diff` `^30.4.1` became a regular
  `dependency`, and `normalizeData` joined the `firebase-kit-admin/testing`
  entry point. The admin README lost its `firestore-snapshot-utils` section.
- **Task 1.3** replaced the `firebase-admin` peer range with `^14.2.0`, which
  task 1.2 had unblocked.
- **Task 1.4** replaced the `getsetdel` peer range with `^3.0.0` and deleted the
  README paragraph explaining the old v2 pin.
- **Task 1.5** **removed `createGetSetDelMock`** (consumers import it from
  `getsetdel/testing` now), dropped `fake-indexeddb`, rewrote the client README's
  testing setup around `getsetdel/testing/idb-keyval`, and **renamed the
  published `firebase-kit-client/testing` subpath to
  `firebase-kit-client/mocks`**.

The last two tasks are the highest-value things to verify here: an entry point
was renamed and lost an export, a new runtime dependency was added, and the
README's testing instructions were rewritten — and nothing in the repo's own
suite can catch a mistake in any of it.

The config's Test exceptions entry is explicit about the mechanism, and about one
trap in particular:

> verify by packing the tree with **`yarn pack`** (never `npm pack` — only Yarn's
> packer rewrites the `workspace:` protocol to a concrete version, so an
> npm-packed tarball of a dependent package is uninstallable) into a throwaway
> consumer project outside the repo and running the documented snippets verbatim
> (extract each block to the path in its header comment). Reading the snippets is
> not verification.

## Files to modify/create

None in the repo. This task produces **evidence**, not changes.

Work in a scratch directory outside the repository tree. If a defect turns up,
fix it in the package it belongs to and re-run this task from the top — do not
paper over it in the throwaway consumer.

## Implementation details

1. Pack all three workspaces with **`yarn pack`**, never `npm pack`. Both
   `firebase-kit-client` and `firebase-kit-admin` depend on
   `firebase-kit-protocol` via `workspace:*`, and only Yarn's packer rewrites
   that protocol to a concrete version — an npm-packed tarball of either
   dependent is simply uninstallable, which is why the config forbids it.

2. Create a throwaway consumer project **outside the repo** (use the session
   scratch directory, not `/tmp` and not a subdirectory of the repo — a nested
   project can resolve the monorepo's `node_modules` and produce a false pass).
   Give it `"type": "module"` and `engines.node >= 24` to match what the packages
   declare.

3. Install the three tarballs plus the peer set the READMEs now document. Install
   peers **explicitly at the documented ranges** rather than letting a package
   manager auto-install them — the point is to confirm the documented ranges
   resolve together. From the two READMEs, that is at minimum:
   - admin: `firebase-admin@^14.2.0`, `firebase-functions@^7.3.2`,
     `betterbe@^4.1.0`, and `vitest@^4.1.10` for the test harness
   - client: `firebase@^12.17.1`, `getsetdel@^3.0.0`, and `vitest@^4.1.10`

   **`firestore-snapshot-utils` must NOT be installed.** Task 1.2 merged it in,
   so it is no longer a peer. If the admin README still asks for it, that is a
   defect from task 1.2.

   **Use npm for this install, not only Yarn.** Yarn downgrades peer conflicts to
   `YN0060` warnings while npm hard-fails with `ERESOLVE` — and npm's stricter
   behavior is what a consumer following the README will hit. A peer-resolution
   warning or error from either is a real finding: it means the declared ranges
   disagree with each other or with the READMEs.

   This is the check that would have caught the original blocker: while
   `firestore-snapshot-utils` was still a peer, it capped `firebase-admin` at
   `^13.5.0` and made `firebase-admin@^14` uninstallable for a consumer. Confirm
   that conflict is genuinely gone rather than merely unreported.

4. Extract every documented snippet to **the path named in its header comment**
   and run it verbatim. Do not adapt a snippet to make it work — if it needs
   adapting, the README is wrong and that is the finding. Cover at least:
   - The install snippets in both READMEs (they are the first thing a consumer
     runs, and the client one changed in task 1.4 to `getsetdel@^3.0.0`).
   - An import from each subpath in both `exports` maps, confirming each resolves
     and is typed. Admin: `.`, `./auth`, `./callable`, `./errors`, `./firestore`,
     `./mocks`, `./runtime`, `./tasks`, `./testing`, `./validation`. Client: `.`,
     `./callable`, `./connectivity`, `./firestore`, `./rate-limit`, `./runtime`,
     **`./mocks`** (renamed from `./testing` by task 1.5).
   - **The client README's rewritten testing setup** — the `vi.mock('idb-keyval',
     ...)` setup file, the `beforeEach(testClearMockIndexedDB)`, the
     `server.deps.inline: ['getsetdel']` vitest config, and a `__mocks__/getsetdel`
     shim importing `createGetSetDelMock` from `getsetdel/testing`. Run an actual
     test through it. This is the single most valuable check in the task.
   - **`firebase-kit-admin/testing`'s merged surface** — `getDBSnapshot`,
     `getDBChanges`, `getDBChangesDiff`, and the newly exported `normalizeData`,
     all resolving from the package itself with no `firestore-snapshot-utils`
     installed. Confirm `jest-diff` arrives transitively rather than needing an
     explicit install.

5. Confirm the three removals fail loudly rather than silently, and that no
   README still instructs any of them:
   - `import { createGetSetDelMock } from 'firebase-kit-client/testing'` — fails
     on both counts (the export is gone and so is the subpath).
   - Any import from `firebase-kit-client/testing` — the subpath no longer
     exists; a consumer should get a clear resolution error, not a silent
     `undefined`.
   - `import { normalizeData } from 'firestore-snapshot-utils'` with the package
     not installed — confirms nothing in the shipped tree still reaches for it.

6. Type-check the consumer project against the packed `.d.ts` files, not against
   the repo's source. This is what catches a broken `exports` map or a `.d.ts`
   that references a file excluded by the packages' `files` globs — each package
   ships `dist` while excluding `__test__`, `__mocks__`, and `*.test.*`.

7. Record the evidence in the task report: the exact commands run, the resolved
   version of each peer, each snippet exercised and its result, and the outcome
   of step 5.

## Testing suggestions

This task **is** the test. Its output is evidence, and per the config, reading
the snippets is explicitly not verification — each one must actually run.

- Keep the consumer install log. A peer warning that gets scrolled past is the
  most likely way a real defect escapes this task.
- If a snippet fails, fix the source package and restart from step 1 with freshly
  packed tarballs. A tarball built before the fix will silently retest the bug.

## Gotchas

- **`npm pack` produces an uninstallable tarball here.** It leaves
  `"firebase-kit-protocol": "workspace:*"` verbatim in the dependents'
  manifests. Use `yarn pack`. The config calls this out specifically.
- **Do not create the consumer inside the repo tree.** Node's resolution walks
  upward, so a nested project can satisfy imports from the monorepo's own
  `node_modules` and pass even when the packed tarballs are broken.
- **Install peers explicitly.** Letting the package manager auto-install peers
  hides exactly the range disagreement this task exists to find.
- **`server.deps.inline: ['getsetdel']` must appear in the consumer's vitest
  config too**, because it is a property of how getsetdel is consumed, not of
  this repo. If the client README's rewritten section omits it, the consumer's
  first `createStore` fails with `ReferenceError: indexedDB is not defined` from
  inside `node_modules/idb-keyval` — and that is a README defect to fix, not a
  consumer-project problem to work around.
- **`vitest` is an optional peer** of both packages (`peerDependenciesMeta`), and
  after task 1.2 it is the admin package's *only* optional peer. Verify both
  paths: the production entry points must import cleanly **without** it
  installed, and `./testing` / `./mocks` must work once it is. Installing
  everything up front hides a wrongly-required dependency.
- **`jest-diff` must arrive transitively, not as something the consumer installs.**
  Task 1.2 made it a regular `dependency` precisely so consumers install nothing
  extra. If `firebase-kit-admin/testing` fails without an explicit `jest-diff`
  install, it was declared in the wrong block.
- **Clean the consumer between runs.** A stale `node_modules` or lockfile from a
  previous attempt can mask a resolution change.

## Verification checklist

- [ ] All three packages were packed with `yarn pack`; no `npm pack` was used anywhere
- [ ] The consumer project lives outside the repository tree
- [ ] The packed `firebase-kit-client` and `firebase-kit-admin` manifests contain a concrete `firebase-kit-protocol` version, not `workspace:*`
- [ ] Every peer was installed explicitly at its README-documented range, and the install produced no peer-resolution warning or error — verified with **npm**, not only Yarn
- [ ] `firestore-snapshot-utils` was not installed, and nothing required it
- [ ] `jest-diff` arrived transitively; `firebase-kit-admin/testing` works without installing it explicitly
- [ ] Every subpath in both `exports` maps was imported and resolved, including the renamed client `./mocks`
- [ ] `firebase-kit-admin/testing` exposes `getDBSnapshot`, `getDBChanges`, `getDBChangesDiff`, and `normalizeData`
- [ ] The admin production entry points import cleanly with `vitest` **absent**, and `./testing` / `./mocks` work with it present
- [ ] The client README's rewritten testing setup was reproduced verbatim and an actual test ran through the in-memory getsetdel backend
- [ ] All three removals fail loudly: `createGetSetDelMock` from the client, the whole `firebase-kit-client/testing` subpath, and any residual reach for `firestore-snapshot-utils` — and no README still instructs any of them
- [ ] The consumer type-checks against the packed `.d.ts` files
- [ ] Every snippet ran verbatim — none was adapted to make it pass
- [ ] **The squashed merge commit message carries a breaking-change footer** (a `!` after the type, or a `BREAKING CHANGE:` body). `.github/workflows/publish.yml` derives the version from commit footers alone, and `Ship` is `merge (squash)` — without the footer this publishes as a minor and consumers on the v1 range resolve peers they cannot satisfy. No test or quality gate catches this.
- [ ] End-to-end tests: this task **is** the substitute verification for the config's *consumer-facing wiring* Test exception. The evidence recorded in the task report is the deliverable.
