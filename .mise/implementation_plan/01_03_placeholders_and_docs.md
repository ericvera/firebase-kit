# Task 1.3: Placeholder packages and maintainer documentation

## Goal

Add three minimal placeholder packages at version `0.0.1` that exist only so the
npm names can be registered, plus the maintainer documentation covering the
bootstrap and release-recovery procedures.

## Requirements addressed

REQ-PKG-1, REQ-PKG-2, REQ-BOOT-1, REQ-BOOT-2, REQ-BOOT-2a, REQ-BOOT-2b,
REQ-BOOT-3, REQ-BOOT-7, REQ-DOC-1, REQ-DOC-1a

## Background

npm cannot configure a trusted publisher for a package that does not yet exist —
the setting lives on an existing package's settings page. All three names
(`firebase-kit-protocol`, `firebase-kit-client`, `firebase-kit-admin`) are
currently unregistered, so each needs one manual publish before the automated
pipeline can take over. These placeholders are what the maintainer publishes.

Task 1.1 created the root skeleton on `main` (private `@firebase-kit/monorepo`
at `0.0.1`, `workspaces: ["packages/*"]`, quality scripts that pass on an empty
repository). Task 1.2 added `.github/workflows/publish.yml`, which on every push
runs install → build → lint → test → guards → changelog, and whose emulator
setup step resolves the `firebase-tools` version from the dependency graph.

**Continue working directly on `main`.**

## Files to modify/create

- `packages/firebase-kit-protocol/package.json` — placeholder manifest
- `packages/firebase-kit-protocol/README.md` — "coming soon"
- `packages/firebase-kit-client/package.json`, `README.md` — same
- `packages/firebase-kit-admin/package.json`, `README.md` — same
- `package.json` — add the root `firebase-tools` devDependency
- `MAINTAINERS.md` — bootstrap and recovery procedures
- `README.md` — link to `MAINTAINERS.md`

## Implementation details

1. **Three placeholder packages.** Each gets a directory under `packages/` named
   for the npm package, containing exactly two files: a `package.json` and a
   `README.md` saying the package is coming soon and linking to the repository.

   Each manifest carries only what npm requires to accept a publish plus what
   identifies it: the package name, version `0.0.1`, `license: MIT`,
   `repository` pointing at this repo with the package subdirectory, a short
   description, and public access under `publishConfig`.

2. **The placeholders MUST declare no dependencies at all** — no `dependencies`,
   no `peerDependencies`, no `devDependencies`. This is not tidiness. If a
   placeholder declared the `workspace:` dependency the real packages will later
   carry, and it were packed with the wrong tool, it would publish an
   uninstallable `0.0.1` permanently, since npm forbids republishing a version.
   Declaring none removes the hazard outright.

3. **Do not add `exports`, `files`, `main`, or `types`.** The real packages
   declare 7 and 10 entry points respectively, all pointing into build output
   that does not exist yet. A placeholder carrying them would permanently publish
   a `0.0.1` whose entry points resolve to nothing. Task 3.1 adds the real
   metadata to the real packages.

4. **Do not add build, lint, or test scripts** to the placeholders. There is no
   source to build and no tests to run; the root scripts from task 1.1 must
   continue to pass unchanged.

5. **Add `firebase-tools` to the root devDependencies**, pinned to an exact
   version (Okven pins `15.23.0`; match it). Nothing uses it until task 2.3, but
   the emulator setup step added in task 1.2 resolves its version on every run
   and fails when nothing in the workspace declares it — which would fail the
   phase-1 push that task 1.4 requires to be green.

   Note for task 2.4: when `firebase-kit-admin` also declares `firebase-tools`,
   both declarations must pin the **same exact version**, or the resolve step
   emits two locators and writes a malformed cache key.

6. **Confirm the workspace still resolves.** Run an install so `yarn.lock` picks
   up the three new workspaces and the new devDependency, and commit the updated
   lockfile.

7. **Write `MAINTAINERS.md`.** This document is what the maintainer follows at
   the hard stop in task 1.4, and what they return to if a release ever fails
   partway. It must live in the repository, not in this plan — the plan's
   directory is deleted when this work completes. Cover:

   **Bootstrap (one time, after the phase-1 push):**
   - Publishing each placeholder, **`firebase-kit-protocol` first**, for the same
     dependency-order reason the release pipeline uses.
   - The exact command, which must use Yarn's publisher rather than the npm CLI,
     and how the temporary npm token is supplied to it for that one-off run.
     State this explicitly — leaving authentication unstated invites reaching for
     `npm publish`, which this repository must never use for these packages.
   - Configuring the trusted publisher for each of the three packages on
     npmjs.com: repository `ericvera/firebase-kit`, workflow file `publish.yml`.
   - Revoking the temporary token afterwards.
   - Enabling the repository's **"Allow auto-merge"** setting, without which
     every dependabot PR stalls.
   - Ensuring `main`'s branch protection permits the release workflow's own
     version-bump push. If it does not, every release fails before it publishes.

   **Release recovery (if a release publishes some packages but not others):**
   - The attempted version is read from the `chore(release):` version-bump commit
     on `main`, **not** from a tag — the tag is created only after all three
     packages publish, so a partial failure leaves none.
   - Two routes: publish the missing packages manually at that version and then
     create the tag and release, or abandon that version and let the next release
     move forward.
   - State plainly that republishing an existing version is not possible, and
     that a version gap is acceptable.

8. **Link `MAINTAINERS.md` from `README.md`** so it is discoverable.

## Testing suggestions

Per the project's test exception for consumer-facing wiring, the publish path
cannot be exercised by this repository's tests. Substitute verification:

- Run `yarn install --immutable`, `yarn build`, `yarn lint`, `yarn test` — all
  must still pass with the three placeholder workspaces present.
- Inspect what each placeholder would actually publish by packing it with Yarn
  in dry-run form and listing the resulting file set. It should contain the
  manifest and the README and nothing else.
- Confirm the resolve step's command (`yarn info firebase-tools --name-only
  --json`) returns exactly one line.
- Read `MAINTAINERS.md` against the bootstrap steps as if following them cold;
  every command should be copy-pasteable with no gaps.

## Gotchas

- **A placeholder is permanent.** `0.0.1` of each name can never be republished.
  Anything wrong in these manifests — a stray `exports`, a `workspace:`
  dependency — is on the registry forever. Review them before the maintainer
  publishes, not after.
- **Adding the packages must not break the root quality commands.** They were
  made green on an empty repository in task 1.1; three source-free workspaces
  should not change that, but verify rather than assume.
- **`firebase-tools` is large.** Adding it noticeably slows install. That cost is
  unavoidable — the emulator setup step needs it declared from phase 1.
- **Two `firebase-tools` version specifiers will break the cache key later.**
  Pin exactly, and pin the same value in task 2.4.

## Verification checklist

- [ ] Each placeholder directory contains exactly `package.json` and `README.md`
- [ ] No placeholder manifest declares any dependency of any kind
- [ ] No placeholder manifest declares `exports`, `files`, `main`, or `types`
- [ ] Each declares its name, `0.0.1`, MIT, public access, a description, and a
      `repository` with the package subdirectory
- [ ] Root declares `firebase-tools` at an exact version;
      `yarn info firebase-tools --name-only --json` returns one line
- [ ] `yarn install --immutable`, `yarn build`, `yarn lint`, `yarn test` all pass
- [ ] A Yarn dry-run pack of each placeholder lists only the manifest and README
- [ ] `MAINTAINERS.md` covers: protocol-first publish order, the exact publish
      command, how the token is supplied, trusted-publisher values including
      `publish.yml`, token revocation, "Allow auto-merge", branch-protection for
      the bump push, and the full partial-release recovery procedure
- [ ] `README.md` links to `MAINTAINERS.md`
- [ ] End-to-end tests: none — the project's test exception for consumer-facing
      wiring applies; substitute verification is the dry-run pack inspection and
      the cold read-through of `MAINTAINERS.md` above
