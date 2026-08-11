# Task 3.3: Verify through a real packed consumer project

## Goal

Pack all three packages, install them into a throwaway consumer project outside
this repository, and confirm that what a real consumer receives actually works —
entry points resolve, the inter-package dependency resolves, and every README
example holds up.

## Requirements addressed

REQ-PKG-3, REQ-PKG-4, REQ-PKG-5, REQ-DOC-4, REQ-DOC-6, REQ-DOC-6a, REQ-TOOL-1a

## Background

**Work on the mise feature branch.** Tasks 2.1–2.4 landed the packages, task 3.1
gave them publication metadata and verified their tarball listings, and task 3.2
wrote the READMEs with file-path header comments on every runnable block.

This task exists because **the repository's own tests import source directly and
therefore cannot exercise any of this.** The packages could have a broken
`exports` map, an unresolvable inter-package dependency, or entirely fictional
README examples, and the full suite would still pass. This is the project's
prescribed verification for consumer-facing wiring, and it is the last check
before the release commit.

### The two facts that make or break this task

**Pack with Yarn's packer, never npm's.** Yarn rewrites the `workspace:` protocol
to a concrete version at pack time; npm does not. An npm-packed
`firebase-kit-client` or `firebase-kit-admin` would carry a literal
`"firebase-kit-protocol": "workspace:*"` and be uninstallable. This is exactly
the defect the verification is supposed to catch, so using the wrong packer turns
the check into a false alarm — or worse, a false pass.

**The consumer must resolve `firebase-kit-protocol` from the packed tarball, not
from the registry.** At this point the packages are still at version `0.0.1`, and
Yarn rewrites the dependents' dependency to exactly `firebase-kit-protocol@0.0.1`
— which on the registry is the content-free bootstrap placeholder published back
in phase 1. Install the dependents naively and every example fails to resolve
protocol, for a reason that has nothing to do with the code under test. Wire the
consumer project so all three tarballs are installed together and the dependents
bind to the local protocol tarball.

### What can and cannot execute

Some examples cannot run standalone:
- `firebase-kit-admin`'s entry points generally need a live Firestore/Auth
  emulator and an initialized admin app.
- `firebase-kit-client`'s need an IndexedDB implementation.

Those blocks are **type-checked in the consumer project rather than executed**,
which still proves the imports resolve and the signatures match. Which blocks
were type-checked instead of run must be recorded — a type-checked block is
weaker evidence than an executed one, and silently conflating the two would
overstate the verification.

## Files to modify/create

No files in this repository change, unless the verification finds defects — in
which case fix them in the package or README they belong to and re-run.

The consumer project is created **outside** this repository, in a scratch
directory, and is not committed.

## Implementation details

1. **Build, then pack all three packages with Yarn**, producing three tarballs.
   Keep them somewhere outside the repository tree.

2. **Create a throwaway consumer project** in a scratch directory outside this
   repository. Give it its own manifest, ESM, Node >= 24, and a TypeScript setup
   using the same modern module resolution a real consumer would use — this is
   what exercises the `exports` map and the `.js` → `.d.ts` sibling rule that
   these packages rely on instead of `main`/`types`.

3. **Install all three tarballs together**, wired so the dependents resolve
   `firebase-kit-protocol` from the local tarball rather than the registry.
   Confirm before going further that the installed
   `node_modules/firebase-kit-protocol` contains real build output and not the
   placeholder's README — that single check catches the whole failure mode.

4. **Install the peer dependencies** a real consumer would need: `firebase` and
   `getsetdel` at major 2 for the client; `firebase-admin`, `firebase-functions`,
   and `betterbe` for the admin package. Add the optional peers only where an
   example needs them.

5. **Confirm no published manifest contains the workspace protocol.** Inspect the
   installed `package.json` of each of the three packages in the consumer's
   `node_modules` and confirm the dependency on `firebase-kit-protocol` is a
   concrete version range. This is the direct check for the npm-versus-Yarn
   packer hazard.

6. **Resolve every published entry point.** Import each of the 18 subpaths — 1
   protocol, 7 client, 10 admin — from the consumer project and confirm each
   resolves and type-checks. This is the broadest single check in the task and
   the cheapest place to catch a typo in an `exports` map.

7. **Extract and verify every README code block.** For each block carrying a
   file-path header comment, write it to that path in the consumer project and
   then either execute it or type-check it:
   - Execute where the example is self-contained.
   - Type-check where it needs an emulator or an IndexedDB implementation.

   **Reading the snippets is not verification.** Any block that fails is a defect
   in the README (task 3.2) or the package — fix it there and re-run.

8. **Record the verification result**: which blocks executed, which were
   type-checked and why, and which entry points were resolved. This record is the
   evidence for the acceptance pass.

9. **Clean up.** Delete the consumer project and the tarballs. Nothing from this
   task is committed.

## Testing suggestions

This task *is* the testing task for consumer-facing wiring — it is the substitute
verification the project's test exception prescribes, since the repository's own
tests cannot reach any of this. Beyond the steps above:

- Re-run the full repository suite afterwards to confirm no fix made during this
  task regressed anything: `yarn build`, `yarn lint`, `yarn test`.
- If any defect was found and fixed, re-pack and re-run the affected checks
  rather than assuming the fix was sufficient.

## Gotchas

- **Using npm to pack produces a tarball that looks fine and is broken.** The
  `workspace:*` string sits in the installed manifest and only fails at install
  time for the consumer.
- **`firebase-kit-protocol@0.0.1` exists on the registry and is empty.** If the
  consumer resolves it from npm, every failure will point at the wrong place. The
  step 3 check exists precisely to rule this out first.
- **A consumer on legacy module resolution gets nothing**, because these packages
  declare no `main` or `types`. That is a deliberate, recorded decision — use
  modern resolution in the consumer project and do not "fix" it by adding those
  fields.
- **`./mocks` on `firebase-kit-admin` is a real entry point** and must resolve
  like any other; if it is missing, the packaging exclusion is wrong.
- **Type-checking is weaker than executing.** Record which is which rather than
  reporting a uniform pass.
- **Do the peer installs deliberately.** Missing peers produce resolution errors
  that look like packaging defects.

## Verification checklist

- [ ] All three packages packed with Yarn's packer, not npm's
- [ ] A throwaway consumer project was created outside this repository, using
      modern module resolution
- [ ] The installed `firebase-kit-protocol` contains real build output, not the
      phase-1 placeholder README
- [ ] No installed manifest contains a `workspace:` range; the dependency on
      protocol is a concrete version
- [ ] All 18 published entry points resolve and type-check from the consumer
- [ ] Every README code block with a path header was extracted and either
      executed or type-checked
- [ ] The record states which blocks executed, which were type-checked, and why
- [ ] Any defect found was fixed in the package or README and re-verified against
      a fresh pack
- [ ] The consumer project and tarballs were deleted; nothing from this task is
      committed
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test` all pass afterwards
- [ ] End-to-end tests: none — the project's test exception for consumer-facing
      wiring applies, and **this task is its substitute verification**: the packed
      consumer project, the 18 entry-point resolutions, and the README block
      execution/type-check record above
