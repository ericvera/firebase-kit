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

**Tasks 1.1, 1.2, and 1.3 already landed**, and the repo's own suite is green.
Between them they changed exactly the things a consumer sees:

- **Task 1.1** moved in-range floors, including two peer ranges: `firebase`
  `^12.17.1` (client) and `firebase-functions` `^7.3.2` (admin).
- **Task 1.2** replaced three peer ranges across a major boundary:
  `firebase-admin` `^14.2.0` and `firestore-snapshot-utils` `^4.0.0` (admin),
  `getsetdel` `^3.0.0` (client). It also updated both READMEs and deleted a
  paragraph explaining the old `getsetdel` v2 pin.
- **Task 1.3** **removed `createGetSetDelMock` from the published
  `firebase-kit-client/testing` entry point** (consumers now import it from
  `getsetdel/testing`), dropped `fake-indexeddb`, and rewrote the client README's
  testing setup around `getsetdel/testing/idb-keyval`.

The last of those is the highest-value thing to verify here: an entry point lost
an export and the README's testing instructions were rewritten, and nothing in
the repo's own suite can catch a mistake in either.

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
     `betterbe@^4.1.0`, and for the test harness
     `firestore-snapshot-utils@^4.0.0` and `vitest@^4.1.10`
   - client: `firebase@^12.17.1`, `getsetdel@^3.0.0`, and `vitest@^4.1.10`

   A peer-resolution warning or error here is a real finding: it means the
   declared ranges disagree with each other or with the READMEs.

4. Extract every documented snippet to **the path named in its header comment**
   and run it verbatim. Do not adapt a snippet to make it work — if it needs
   adapting, the README is wrong and that is the finding. Cover at least:
   - The install snippets in both READMEs (they are the first thing a consumer
     runs, and the client one changed in task 1.2 to `getsetdel@^3.0.0`).
   - An import from each subpath in both `exports` maps, confirming each resolves
     and is typed. Admin: `.`, `./auth`, `./callable`, `./errors`, `./firestore`,
     `./mocks`, `./runtime`, `./tasks`, `./testing`, `./validation`. Client: `.`,
     `./callable`, `./connectivity`, `./firestore`, `./rate-limit`, `./runtime`,
     `./testing`.
   - **The client README's rewritten testing setup** — the `vi.mock('idb-keyval',
     ...)` setup file, the `beforeEach(testClearMockIndexedDB)`, the
     `server.deps.inline: ['getsetdel']` vitest config, and a `__mocks__/getsetdel`
     shim importing `createGetSetDelMock` from `getsetdel/testing`. Run an actual
     test through it. This is the single most valuable check in the task.

5. Confirm `import { createGetSetDelMock } from 'firebase-kit-client/testing'`
   now **fails**, and that the README no longer tells anyone to write it. A
   consumer following the old instructions should get a clear resolution error,
   not a silent `undefined`.

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
- **`firestore-snapshot-utils` and `vitest` are optional peers** of the admin
  package (`peerDependenciesMeta`). Verify both paths: the production entry
  points must import cleanly **without** them installed, and `./testing` and
  `./mocks` must work once they are. Installing everything up front hides a
  wrongly-required dependency.
- **Clean the consumer between runs.** A stale `node_modules` or lockfile from a
  previous attempt can mask a resolution change.

## Verification checklist

- [ ] All three packages were packed with `yarn pack`; no `npm pack` was used anywhere
- [ ] The consumer project lives outside the repository tree
- [ ] The packed `firebase-kit-client` and `firebase-kit-admin` manifests contain a concrete `firebase-kit-protocol` version, not `workspace:*`
- [ ] Every peer was installed explicitly at its README-documented range, and the install produced no peer-resolution warning or error
- [ ] Every subpath in both `exports` maps was imported and resolved
- [ ] The admin production entry points import cleanly with the optional peers **absent**, and `./testing` / `./mocks` work with them present
- [ ] The client README's rewritten testing setup was reproduced verbatim and an actual test ran through the in-memory getsetdel backend
- [ ] `import { createGetSetDelMock } from 'firebase-kit-client/testing'` fails, and no README still instructs it
- [ ] The consumer type-checks against the packed `.d.ts` files
- [ ] Every snippet ran verbatim — none was adapted to make it pass
- [ ] End-to-end tests: this task **is** the substitute verification for the config's *consumer-facing wiring* Test exception. The evidence recorded in the task report is the deliverable.
