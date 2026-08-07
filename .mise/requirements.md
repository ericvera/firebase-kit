# Requirements

This document specifies the requirements for turning `/Users/eric/Code/firebase-kit`
into a published, auto-publishing monorepo for the three `firebase-kit-*` packages.

Two audiences are served: **consumers** installing the packages from npm, and the
**maintainer** releasing them. "The system" means the repository together with its
GitHub Actions publishing pipeline.

## 1. Repository structure

- **REQ-REPO-1:** The repository MUST contain exactly three publishable packages
  under `packages/`: `firebase-kit-protocol`, `firebase-kit-client`, and
  `firebase-kit-admin`.
- **REQ-REPO-2:** The root package MUST be named `@firebase-kit/monorepo`, MUST be
  private, and MUST NOT be publishable to npm.
- **REQ-REPO-3:** The root package MUST declare `packages/*` as its workspaces so
  that a single install at the root wires all three packages together.
- **REQ-REPO-4:** `firebase-kit-client` and `firebase-kit-admin` MUST each depend
  on `firebase-kit-protocol` through the **exact** workspace protocol
  (`workspace:*`), so that after the publish-time rewrite a consumer receives a
  pinned equality range rather than a caret range. `workspace:^`, as used inside
  Okven today, MUST NOT be carried over.
- **REQ-REPO-5:** The repository MUST be a public GitHub repository named
  `firebase-kit` under the `ericvera` account.
- **REQ-REPO-6:** The repository MUST carry an MIT `LICENSE` file at the root.
- **REQ-REPO-7:** The repository MUST NOT contain any file that imports from an
  `@okv/*` package, and MUST NOT depend on the Okven repository at build, test, or
  publish time.

## 2. Toolchain

These are externally observable and several other requirements silently depend on
them, so they are stated rather than left to the implementer.

- **REQ-TOOL-1:** The repository MUST use Yarn **4.18.0 or newer** with
  `node-modules` linking, pinned via a committed Yarn release. The lower bound is
  load-bearing, not cosmetic: `yarn npm publish`'s OIDC token exchange — which
  REQ-PUB-4 depends on — does not exist in earlier Yarn 4 releases.
- **REQ-TOOL-2:** Because Yarn Berry does not run npm's `prepare` lifecycle, git
  hook installation MUST be wired through Yarn's after-install mechanism. A fresh
  clone followed by an install MUST leave working commit hooks without any extra
  manual step.
- **REQ-TOOL-3:** The lockfile MUST be committed, and a clean install from it MUST
  succeed in CI without network-driven resolution drift.
- **REQ-TOOL-4:** Linting MUST work from a clean checkout. Any TypeScript project
  configuration the lint setup requires in order to type-check files not covered
  by a package `tsconfig.json` MUST be present and committed.
- **REQ-TOOL-5:** `.mise/` MUST NOT be git-ignored — the workflow that produced
  this document requires it to be committed on feature branches. It is kept off
  `main` by process and by REQ-GUARD-1, never by `.gitignore`.

## 3. Package identity and published contents

- **REQ-PKG-1:** Each package MUST publish under its existing unscoped name —
  `firebase-kit-protocol`, `firebase-kit-client`, `firebase-kit-admin`.
- **REQ-PKG-2:** Each package MUST publish with public access.
- **REQ-PKG-3:** Each published tarball MUST contain the package's compiled
  output, its own `README.md`, and its own `LICENSE` file. It MUST exclude test
  files (`*.test.*`), test fixtures (`__test__`), and module shims (`__mocks__`).
  It MUST NOT exclude `firebase-kit-admin`'s `mocks/` build output — despite the
  name, that is a shipped public entry point (REQ-PKG-5), not test scaffolding.
- **REQ-PKG-3a:** Each package MUST carry its own `LICENSE` file. A root-level
  `LICENSE` is not copied into a subpackage tarball by the packing tool, so
  REQ-REPO-6 alone would leave consumers with no license text.
- **REQ-PKG-4:** A consumer installing a published package MUST receive a
  `firebase-kit-protocol` dependency pinned to a concrete published version — the
  workspace protocol MUST NOT appear in any published `package.json`.
- **REQ-PKG-5:** Each package's published entry points MUST be unchanged from
  what Okven consumes today:
  - `firebase-kit-protocol`: `.`
  - `firebase-kit-client`: `.`, `./callable`, `./connectivity`, `./firestore`,
    `./rate-limit`, `./runtime`, `./testing`
  - `firebase-kit-admin`: `.`, `./auth`, `./callable`, `./errors`, `./firestore`,
    `./mocks`, `./runtime`, `./tasks`, `./testing`, `./validation`
- **REQ-PKG-6:** Each package MUST declare Node >= 24 as its supported engine and
  MUST be published as an ES module.
- **REQ-PKG-7:** Each package MUST declare, in its published metadata: a
  human-readable description, the `ericvera/firebase-kit` repository **including
  the subdirectory** that holds it, and the MIT license — so the npm package page
  shows what the package is and links to its own source rather than the monorepo
  root.
- **REQ-PKG-8:** Each package's runtime, peer, and optional-peer dependency
  declarations MUST match what the package actually imports — no dependency
  carried over from Okven that the package does not use, and none omitted.
- **REQ-PKG-9:** Every declared version range MUST be one the test suite actually
  runs against, so a consumer installing at the low end of a range gets a
  combination that was exercised. Widening a range to a newer major that the
  tests have not been run against is out of scope for this work.

## 4. Versioning

- **REQ-VER-1:** All three packages and the root package MUST always share one
  identical version number.
- **REQ-VER-2:** Every release MUST publish all three packages at that shared
  version, regardless of which package changed.
- **REQ-VER-3:** The version number MUST be derived from conventional commit
  messages since the previous release.
- **REQ-VER-4:** The first release containing the real package sources MUST
  publish all three packages at exactly `1.0.0`.
- **REQ-VER-5:** The release commit that produces `1.0.0` MUST carry a
  `BREAKING CHANGE:` footer. A `!`-suffixed type (`feat!:`) MUST NOT be relied on
  for this, because the configured preset does not detect it reliably.
- **REQ-VER-6:** Each release MUST create a matching git tag and a GitHub release
  whose notes are the generated changelog for that version. Exactly one tag MUST
  be created per release.
- **REQ-VER-7:** The repository MUST NOT maintain a committed `CHANGELOG.md` —
  changelog content lives in the GitHub release notes.

## 5. Automated publishing

- **REQ-PUB-1:** A push to `main` MUST be the only **automatic** trigger that
  publishes. A manual trigger MAY exist solely to re-run a failed release
  (REQ-PUB-10); no other automatic trigger is permitted.
- **REQ-PUB-2:** A push to `main` containing no release-worthy conventional
  commits MUST complete without publishing anything, without creating a tag, and
  without failing.
- **REQ-PUB-3:** A release MUST NOT publish unless the repository's build, lint,
  and full test suite (including emulator tests) all pass first.
- **REQ-PUB-4:** Publishing MUST authenticate through npm Trusted Publishing
  (OIDC). The repository MUST NOT require, store, or reference a long-lived npm
  token secret.
- **REQ-PUB-5:** Each publish MUST attach npm provenance. Provenance MUST be
  enabled by explicit configuration; it MUST NOT be assumed to come from the
  publishing tool's defaults.
- **REQ-PUB-6:** `firebase-kit-protocol` MUST be published before
  `firebase-kit-client` and `firebase-kit-admin`. At no point may a published
  package reference a `firebase-kit-protocol` version that is not yet installable.
- **REQ-PUB-7:** The version bump MUST be committed back to `main` **before** any
  package is published, in a commit that does not itself trigger another release.
  Fixing this order is what makes REQ-PUB-10's failure state knowable: the
  repository's recorded version is always at or ahead of what is on npm, never
  behind.
- **REQ-PUB-8:** Release runs MUST be serialized, and a run that has begun
  publishing MUST NOT be cancelled by a newer push — cancelling mid-sequence
  would strand some packages published at a version and others not.
- **REQ-PUB-9:** If publishing any package fails, the workflow run MUST fail
  visibly, and the remaining packages MUST NOT be published at that version.
- **REQ-PUB-10:** A partially-published release MUST be recoverable. Because npm
  rejects republishing an existing version, an unattended re-run cannot complete
  one — so the repository MUST document a maintainer recovery procedure covering
  both available routes: publishing the missing packages manually at the already
  tagged version, or abandoning that version and letting the next release move
  forward, leaving a version gap. The procedure MUST state that a version gap is
  acceptable and that republishing is not possible.

## 6. Bootstrap

- **REQ-BOOT-1:** Because npm cannot configure a trusted publisher for a package
  that does not yet exist, each of the three names MUST first exist on npm as a
  placeholder release before the automated pipeline can publish it.
- **REQ-BOOT-2:** Each placeholder MUST be version `0.0.1` and MUST contain only
  a `README.md` stating the package is coming soon, plus the minimum metadata npm
  requires to accept it. The root package MUST also be at `0.0.1`, since that is
  the version the release tooling reads to compute the next one (REQ-VER-4).
- **REQ-BOOT-2a:** The phase-1 workflow run MUST pass. The skeleton's build,
  lint, and test configuration MUST therefore be consistent with a repository that
  contains no TypeScript sources and no tests — a build referencing package
  projects that do not exist yet, or a test runner that treats "no test files" as
  failure, MUST NOT be committed in that state.
- **REQ-BOOT-3:** The placeholder release MUST be publishable by the maintainer
  from a terminal — the system MUST NOT attempt to publish the placeholders
  itself.
- **REQ-BOOT-4:** The placeholder skeleton MUST reach `main` without `.mise/` ever
  being committed to `main`.
- **REQ-BOOT-5:** The first push to `main` MUST NOT attempt to publish, because
  trusted publishing is not yet configured at that point. This MUST be achieved by
  the commit being non-release-worthy, not by disabling or omitting the workflow.
- **REQ-BOOT-6:** The work MUST stop after the placeholder skeleton is pushed and
  MUST NOT proceed to moving the real sources until the maintainer confirms the
  placeholders are published and the trusted publishers are configured.
- **REQ-BOOT-7:** The repository MUST include written maintainer setup
  instructions covering: publishing each placeholder, the exact values to enter
  when configuring each package's trusted publisher (repository
  `ericvera/firebase-kit` and the workflow file name), revoking the temporary
  token afterwards, and enabling the repository settings that automated dependency
  merging depends on.
- **REQ-BOOT-8:** The workflow file name referenced by the trusted publisher
  configuration MUST NOT change after the maintainer configures it.

## 7. Quality gates

- **REQ-QUAL-1:** The repository MUST provide a single root command each for
  formatting, linting, building, and testing that covers all three packages.
- **REQ-QUAL-2:** The repository MUST provide separate commands to run unit tests
  alone and emulator tests alone, plus a command running both.
- **REQ-QUAL-3:** The full test command MUST run both unit and emulator tests.
- **REQ-QUAL-3a:** The root test commands MUST cover every package that has tests
  while preserving each package's own test setup — its setup files and its mock
  reset behavior — and MUST succeed rather than error on a package that has no
  tests at all (`firebase-kit-protocol`).
- **REQ-QUAL-3b:** The emulator test command MUST run with
  `firebase-kit-admin`'s emulator configuration in effect, since the emulator
  ports and Firestore rules are declared package-locally.
- **REQ-QUAL-4:** Linting MUST apply the same type-aware strict configuration the
  maintainer's other library repositories use — recommended plus
  `strictTypeChecked` plus `stylisticTypeChecked`, together with the local rules:
  `curly`, `line-comment-position: above`, `max-len` of 80 for comments only,
  `prefer-function-type` off, and no `describe` wrappers in test files. The
  repository MUST lint clean; findings are fixed, not suppressed by disabling
  rules wholesale.
- **REQ-QUAL-5:** The build MUST type-check all three packages under the
  project's strictest TypeScript settings and MUST emit type declarations that
  consumers can use.
- **REQ-QUAL-5a:** Emitted declarations MUST retain doc comments, so consumers
  get documentation in editor tooling. The Okven tsconfigs strip them
  (`removeComments: true`) and MUST NOT be carried over in that state.
- **REQ-QUAL-6:** Committing MUST format and lint staged files automatically.
- **REQ-QUAL-7:** Publishing from CI MUST NOT be blocked or altered by git hook
  machinery — a release run MUST NOT fail, and MUST NOT skip a package, because a
  hook or lifecycle script fired or failed to fire.

## 8. Tests

- **REQ-TEST-1:** All existing tests MUST be carried over and MUST pass in the new
  repository. Counts to reconcile against after the move:

  | Package                 | Unit test files | Unit `it()` | Emulator test files | Emulator `it()` |
  | ----------------------- | --------------- | ----------- | ------------------- | --------------- |
  | `firebase-kit-protocol` | 0               | 0           | 0                   | 0               |
  | `firebase-kit-client`   | 29              | 149         | 0                   | 0               |
  | `firebase-kit-admin`    | 48              | 180         | 7                   | 21              |

- **REQ-TEST-2:** Test behavior MUST be preserved: no test may be deleted,
  skipped, or weakened to accommodate the move or the stricter lint configuration.
- **REQ-TEST-3:** Emulator tests MUST run against the Firebase emulator suite and
  MUST NOT require a real Firebase project or network credentials.
- **REQ-TEST-4:** Emulator tests MUST be distinguishable from unit tests by file
  name alone, so either group can be run without the other.
- **REQ-TEST-5:** Any CI job that runs the emulator tests MUST provision a Java
  runtime and MUST NOT re-download the emulator binaries on every run when the
  toolchain version is unchanged. This applies to the release workflow and to the
  automated dependency-update checks alike.
- **REQ-TEST-6:** Tests MUST NOT use `describe` wrappers; the existing flat `it()`
  structure MUST be preserved.

## 9. Documentation

- **REQ-DOC-1:** The repository root MUST have a `README.md` that states the
  monorepo's purpose, links to each package, and links to the maintainer setup
  and release-recovery documentation.
- **REQ-DOC-1a:** The maintainer instructions required by REQ-BOOT-7 and the
  recovery procedure required by REQ-PUB-10 MUST live in committed files in the
  repository, not only in this workflow's artifacts, which are deleted at
  close-out.
- **REQ-DOC-2:** Each package MUST have a `README.md` covering its purpose,
  installation, its exported entry points, and at least one usage example.
- **REQ-DOC-3:** Each package README MUST state its required peer dependencies so
  a consumer knows what to install alongside it.
- **REQ-DOC-4:** Every code example in a README MUST be accurate against the
  package's actual exported API.
- **REQ-DOC-5:** Each README code block that is meant to be a runnable file MUST
  carry a header comment naming the file path it represents, so the block can be
  extracted and executed verbatim during verification.

## 10. Dependency automation

- **REQ-DEP-1:** Dependency updates MUST be proposed automatically on a weekly
  schedule for both npm dependencies and GitHub Actions.
- **REQ-DEP-2:** Non-major dependency update proposals MUST be grouped rather
  than opened one pull request per package.
- **REQ-DEP-3:** An automated dependency update MUST pass build, lint, and the
  full test suite before it can merge.
- **REQ-DEP-4:** Major-version dependency updates MUST NOT auto-merge, for any
  ecosystem.

## 11. In-flight work guard

- **REQ-GUARD-1:** A `.mise/` directory reaching `main` MUST cause the workflow
  run to fail and MUST prevent that run from publishing anything.
- **REQ-GUARD-2:** The guard MUST NOT prevent the workflow's build, lint, and test
  steps from running, so a guard trip still reports the state of the code. Taken
  with REQ-GUARD-1, this fixes the guard's position: it runs **after** build,
  lint, and test, and **before** any version-bump, tag, publish, or release step.
- **REQ-GUARD-3:** The guard MUST take precedence over REQ-PUB-2: a push carrying
  `.mise/` MUST fail even when it contains no release-worthy commits.

## Out of Scope

- Any modification to the Okven repository. Switching Okven's `workspace:^`
  dependencies to the published npm versions, and deleting
  `okven/packages/firebase-kit-*`, is separate later work.
- Changes to the packages' public API, exported symbols, or runtime behavior.
  Source edits are limited to what the move and the stricter lint configuration
  require.
- Adding tests for previously untested code. `firebase-kit-protocol` ships with no
  tests today and MAY continue to.
- A separate pull-request CI workflow. The push-to-`main` publish workflow is the
  quality gate, matching the maintainer's other library repositories.
- Preserving the packages' git history from Okven.
- Publishing to any registry other than npm.
- Migration guides or changelogs describing differences from the in-Okven
  versions; version `1.0.0` is the first public release.

## Assumptions

- **The bootstrap stop is a hard stop.** REQ-BOOT-6 blocks on an explicit
  maintainer confirmation rather than a timer or an inferred signal, because a
  premature resume would push a release that cannot authenticate.
- **Phase 1 is authored directly on `main`, outside the mise pipeline.** This is
  how REQ-BOOT-4 is satisfied without git-ignoring `.mise/` (REQ-TOOL-5) and
  without an exception to the repository's never-merge-`.mise/` rule.
- **The `0.0.1` → `1.0.0` mechanism is verified, not assumed.** The release action
  computes `semver.inc(version, releaseType)` with no special handling for `0.x`,
  and its default preset classifies a `BREAKING CHANGE:` footer as a major bump.
  Hence REQ-VER-4 and REQ-VER-5 together are satisfiable. The action's
  `pre-changelog-generation` hook remains available as a deterministic fallback.
- **`firebase-kit-admin`'s `firebase.json` and `firestore.rules` move with the
  package** — they configure the emulator ports and rules its emulator tests
  depend on, and nothing else in Okven references them.
- **The Firebase emulator project id stays `demo-admin-tests`** — the existing
  emulator test script uses it, and a `demo-` prefix is what keeps the emulator
  from contacting real Firebase services.
- **Lint fixes may touch source.** REQ-QUAL-4 requires a clean lint, and the
  packages were written under a laxer configuration, so type-narrowing and
  annotation changes are expected. REQ-TEST-2 and the Out of Scope section bound
  this: behavior and public API must not change.
- **Peer dependencies are re-derived rather than copied.** REQ-PKG-8 exists
  because the packages were authored inside Okven, where a dependency could be
  satisfied by a hoisted root install and go undeclared; standalone publishing
  removes that safety net.
- **Emulator tests are part of the release gate.** This slows every release and
  makes an emulator flake a release failure, accepted deliberately so that a
  published version is never one whose Firestore integration tests were skipped.
  REQ-TEST-5 extends the same cost to dependency-update checks, which would
  otherwise fail for lack of a Java runtime.
- **Six requirements deliberately deviate from the scdate template**, which the
  goals had assumed could be copied verbatim. Each was checked against scdate
  rather than presumed: REQ-DEP-4 (scdate auto-merges npm majors), REQ-PUB-5
  (scdate publishes with no provenance, because `yarn npm publish` does not
  enable it by default), REQ-PUB-8 (scdate sets `cancel-in-progress: true`),
  REQ-PKG-3a and REQ-PKG-7 (no scdate package carries a `LICENSE`, a
  `description`, or a `repository.directory`), and REQ-QUAL-5a (scdate keeps doc
  comments in declarations while the Okven tsconfigs strip them — here scdate is
  the one being followed and Okven the one being departed from).
- **Two goals items are process concerns with no requirement of their own**:
  rebasing the mise feature branch onto the new `main` after phase 1, and having
  the plan stage surface the ESLint fallout count before fixing starts. Both
  govern how the work is sequenced, not what the system must do, so they belong
  to the plan rather than to this document.
- **No `NPM_TOKEN` secret is added even as a fallback.** REQ-PUB-4 forbids it;
  the temporary token used for the placeholder publish is created and revoked by
  the maintainer outside the repository.
- **REQ-PUB-10's recovery procedure is documentation, not automation.** Building
  automated republish/rollback machinery is disproportionate for a three-package
  release; a written procedure discharges the requirement.
