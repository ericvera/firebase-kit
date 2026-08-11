# Task 3.4: Final reconciliation and the `1.0.0` release commit

## Goal

Reconcile the moved packages against the source one last time, confirm the
release pipeline will compute exactly `1.0.0`, and prepare the commit that
publishes all three packages when this branch merges to `main`.

## Requirements addressed

REQ-VER-1, REQ-VER-2, REQ-VER-4, REQ-VER-5, REQ-TEST-1, REQ-PUB-3

## Background

**Work on the mise feature branch.** Everything is in place: all three packages
moved and lint-clean (tasks 2.1–2.3), manifests audited (2.4), publication
metadata and tarball shape verified (3.1), READMEs written (3.2), and the whole
thing verified through a real packed consumer project (3.3).

What remains is the release itself. This branch merges to `main` as a single
squashed commit, and **that commit's message is what drives the version
computation**. Get it wrong and the consequence is permanent: npm forbids
republishing a version.

### How `0.0.1` becomes `1.0.0`

The previous version comes from the **`v0.0.1` git tag** that task 1.4 seeded on
the bootstrap commit — not from `package.json`. The release action is configured
not to create its own release commit, and in that mode it reads the newest
matching git tag instead of any version file. (Its fallback input is unset and
has no default, so with no tag it would produce a hardcoded `0.1.0` regardless of
the commit message.)

Given that tag, the action computes the next version as
`semver.inc('0.0.1', releaseType)` with **no special handling for `0.x`**, and its
default preset classifies a `BREAKING CHANGE:` footer as a `major` bump. So
`0.0.1` + a breaking change → `1.0.0`.

The root and all three packages also read `0.0.1`, matching the placeholders
published during the bootstrap. That uniformity matters for lockstep versioning,
but it is the tag, not those files, that drives the computation.

**The footer form is required.** A `!`-suffixed type (`feat!:`) is not reliably
detected by that preset — this is a known issue with the action, and relying on
it would produce `0.1.0` instead. The commit must carry an actual
`BREAKING CHANGE:` footer.

Task 1.2 added a guard to `publish.yml` that aborts the run, **before** the
version-bump commit, if a version was computed, the current version is the
`0.0.1` placeholder, and the computed version is not exactly `1.0.0`. That guard
is the safety net; this task's job is to not need it.

If the footer route somehow misbehaves, the action exposes a
`pre-changelog-generation` hook with a `preVersionGeneration` function that can
force the version deterministically. Use it only if the footer approach fails —
it is the fallback, not the plan.

### What the release will do

On merge to `main`: install → build → lint → test (including the emulator suite)
→ `.mise/` guard → compute version → `1.0.0` guard → set the version across the
root and all three packages → commit `chore(release): v1.0.0 [skip ci]` → publish
`firebase-kit-protocol`, then `firebase-kit-client`, then `firebase-kit-admin`,
each with Yarn's publisher and provenance → create tag `v1.0.0` and the GitHub
release.

## Files to modify/create

No source files change. This task verifies, and prepares a commit message.

## Implementation details

1. **Reconcile the test counts against the source**, one last time and
   explicitly. The full suite must report:

   | Package                 | Unit files | Unit `it()` | Emulator files | Emulator `it()` |
   | ----------------------- | ---------- | ----------- | -------------- | --------------- |
   | `firebase-kit-protocol` | 0          | 0           | 0              | 0               |
   | `firebase-kit-client`   | 29         | 149         | 0              | 0               |
   | `firebase-kit-admin`    | 48         | 180         | 7              | 21              |

   A count below these means tests are not being picked up — the exact failure
   the per-package test orchestration exists to prevent. Do not proceed on a
   green run alone; check the numbers.

2. **Confirm the lockstep version is uniform.** The root and all three packages
   must all read `0.0.1`. The release workflow sets them together, so a
   divergence here means something bypassed the intended flow.

   **Also confirm the `v0.0.1` tag exists on the remote.** It is what the release
   tooling reads as the previous version; without it the run computes `0.1.0` and
   the guard aborts. Check the remote, not just the local clone.

3. **Confirm no test was lost, skipped, or weakened** relative to the Okven
   source across the whole move. Compare the test file inventory of each package
   against its source directory.

4. **Confirm the working tree is release-ready**: `yarn format` produces no
   changes, `yarn lint` is clean, `yarn build` succeeds, `yarn test` passes
   including the emulator suite. The workflow runs all of these again on `main`,
   and a failure there blocks the release after the branch has already merged.

5. **Verify the `.mise/` directory will not reach `main`.** The mise close-out
   deletes it in a final commit before the merge. If it is still tracked when the
   squash lands, the guard fails the run and no release happens. This is the
   expected order of operations, not something to work around — just confirm it
   happened.

6. **Prepare the release commit message.** It must:
   - use a conventional subject describing the change (the first public release
     of the three packages),
   - carry a `BREAKING CHANGE:` **footer** — not a `!` suffix — whose body
     explains that this is the initial public release, superseding the `0.0.1`
     bootstrap placeholders,
   - be the message that actually lands on `main`, which for a squash merge means
     the squash commit message, not the branch's individual commit messages.

   Write it out and check it against the version-computation rules above before
   merging.

7. **After the merge, watch the workflow run.** Confirm in order: the gates pass,
   the `.mise/` guard passes, the computed version is `1.0.0`, the `1.0.0` guard
   passes, the bump commit lands, all three packages publish in dependency order,
   and the tag and release are created.

8. **If the release fails partway, stop and follow `MAINTAINERS.md`.** Do not
   re-run the workflow hoping it completes — the version bump is already on
   `main`, so a re-run computes a *new* version rather than retrying, and npm
   will reject republishing anything that did land. The recovery procedure covers
   both routes: publish the missing packages manually at that version and then
   create the tag and release, or abandon the version and let the next release
   move forward, leaving a gap.

## Testing suggestions

Per the project's test exception for library packages with no e2e infrastructure,
and the one for consumer-facing wiring, verification here is the full suite plus
the live release run:

- Run `yarn test` and reconcile every count in the step 1 table individually.
- Confirm the emulator suite runs against the local emulator with no real
  Firebase project or credentials.
- After merge, verify on npmjs.com that all three packages exist at `1.0.0`, that
  each page shows its description and links to its own subdirectory, and that
  provenance is attached.
- Install `firebase-kit-admin@1.0.0` from the public registry into a scratch
  project and confirm it pulls `firebase-kit-protocol@1.0.0` and resolves. This
  is the final proof that the packing and ordering were right.

## Gotchas

- **`feat!:` will not produce `1.0.0`.** It is the form most people reach for and
  the preset does not reliably detect it. Use the footer.
- **The squash commit message is what counts**, not the messages on the branch.
- **The version is permanent once published.** There is no undo, only a gap and a
  higher next version.
- **A green branch does not guarantee a green release run.** The workflow re-runs
  everything on `main`, including the emulator suite, which is the most likely
  step to flake.
- **The `1.0.0` guard runs before the bump commit** and aborts cleanly. If it
  fires, nothing has been published or committed — investigate the commit message
  rather than working around the guard.
- **Publishing order is not cosmetic.** If protocol somehow does not publish
  first, the dependents land on the registry pinned to a version nobody can
  install.

## Verification checklist

- [ ] Test counts reconcile exactly: client 29 files / 149 cases; admin 48 files
      / 180 cases unit and 7 files / 21 cases emulator; protocol none
- [ ] Root and all three packages read version `0.0.1`
- [ ] The `v0.0.1` tag exists **on the remote**
- [ ] No test was lost, skipped, or weakened relative to the Okven source
- [ ] `yarn format` is a no-op; `yarn lint`, `yarn build`, `yarn test` all pass
- [ ] The emulator suite runs with no real Firebase project or credentials
- [ ] `.mise/` is not tracked in the tree that will merge to `main`
- [ ] The prepared squash commit message carries a `BREAKING CHANGE:` footer, not
      a `!` suffix
- [ ] After merge: the workflow run is green, the computed version is `1.0.0`,
      all three packages published in dependency order, tag `v1.0.0` and the
      GitHub release exist
- [ ] All three packages are live on npmjs.com at `1.0.0` with descriptions,
      subdirectory source links, and provenance
- [ ] `firebase-kit-admin@1.0.0` installs from the public registry into a scratch
      project and resolves `firebase-kit-protocol@1.0.0`
- [ ] End-to-end tests: none — both project test exceptions apply (library
      packages with no e2e infrastructure; consumer-facing wiring); substitute
      verification is the count reconciliation, the live release run, and the
      public-registry install check above
