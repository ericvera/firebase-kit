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
- **REQ-REPO-4:** In the finished repository, `firebase-kit-client` and
  `firebase-kit-admin` MUST each depend on `firebase-kit-protocol` through the
  **exact** workspace protocol (`workspace:*`), so that after the publish-time
  rewrite a consumer receives a pinned equality range rather than a caret range.
  `workspace:^`, as used inside Okven today, MUST NOT be carried over. This binds
  phase 2; the phase-1 placeholders declare no dependencies at all
  (REQ-BOOT-2b).
- **REQ-REPO-5:** The repository MUST be a public GitHub repository named
  `firebase-kit` under the `ericvera` account. Creating it is part of this work,
  not a maintainer prerequisite.
- **REQ-REPO-6:** The repository MUST carry an MIT `LICENSE` file at the root.
- **REQ-REPO-7:** The repository MUST NOT contain any file that imports from an
  `@okv/*` package, and MUST NOT depend on the Okven repository at build, test, or
  publish time.

## 2. Toolchain

These are externally observable and several other requirements silently depend on
them, so they are stated rather than left to the implementer.

- **REQ-TOOL-1:** The repository MUST use Yarn **4.18.0** with `node-modules`
  linking, pinned by both a committed Yarn release and a `packageManager` field,
  matching the maintainer's other library repositories.
- **REQ-TOOL-1a:** Packing and publishing MUST be done with Yarn's packer, never
  npm's. This is load-bearing: Yarn rewrites the `workspace:` protocol to a
  concrete version at pack time and npm does not, so an npm-packed
  `firebase-kit-client` or `firebase-kit-admin` would publish a literal
  `"firebase-kit-protocol": "workspace:*"` and be uninstallable. This governs the
  release pipeline, the manual bootstrap publishes, and every verification step
  that inspects tarball contents.
- **REQ-TOOL-2:** Because Yarn Berry does not run npm's `prepare` lifecycle, git
  hook installation MUST be wired through Yarn's after-install mechanism. A fresh
  clone followed by an install MUST leave working commit hooks without any extra
  manual step.
- **REQ-TOOL-3:** The lockfile MUST be committed, and CI MUST install with the
  immutable-lockfile setting explicitly in force, so a stale or drifted lockfile
  fails the run rather than being silently rewritten. Relying on the package
  manager's CI-environment default is not sufficient.
- **REQ-TOOL-4:** Linting MUST work from a clean checkout. Any TypeScript project
  configuration the lint setup requires in order to type-check files not covered
  by a package `tsconfig.json` MUST be present and committed — this must cover the
  root-level config files and each package's own test-runner config, both of which
  sit outside the packages' `src`-scoped projects.
- **REQ-TOOL-5:** `.mise/` MUST NOT be git-ignored — the workflow that produced
  this document requires it to be committed on feature branches. It is kept off
  `main` by process and by REQ-GUARD-1, never by `.gitignore`.

## 3. Package identity and published contents

Unless a requirement says otherwise, this section governs the **real** releases.
Only REQ-PKG-1 (names) and REQ-PKG-2 (public access) also bind the phase-1
placeholders; the placeholders' contents are governed by REQ-BOOT-2 and
REQ-BOOT-2b instead. In particular the placeholders MUST NOT declare the entry
points of REQ-PKG-5, which would permanently publish a `0.0.1` pointing at build
output that does not exist.

- **REQ-PKG-1:** Each package MUST publish under its existing unscoped name —
  `firebase-kit-protocol`, `firebase-kit-client`, `firebase-kit-admin`.
- **REQ-PKG-2:** Each package MUST publish with public access.
- **REQ-PKG-3:** Each **real** release tarball (this and REQ-PKG-3a do not apply
  to the phase-1 placeholders) MUST contain the package's compiled output, its own
  `README.md`, and its own `LICENSE` file. It MUST exclude test files
  (`*.test.*`), test fixtures (`__test__`), and module shims (`__mocks__`). It
  MUST NOT exclude `firebase-kit-admin`'s `mocks/` build output — despite the
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
- **REQ-PKG-6:** Each package MUST declare Node >= 24 as its supported engine,
  MUST be published as an ES module, and MUST retain its side-effect-free
  declaration so consumer bundlers can continue to tree-shake it.
- **REQ-PKG-7:** Each package MUST declare, in its published metadata: a
  human-readable description, search keywords, the `ericvera/firebase-kit`
  repository **including the subdirectory** that holds it, and the MIT license —
  so the npm package page shows what the package is, is discoverable by search,
  and links to its own source rather than the monorepo root.
- **REQ-PKG-8:** Each package's dependency declarations — runtime, peer,
  optional-peer, **and development** — MUST match what the package actually uses.
  Development dependencies are explicitly in scope. Note that a green build is
  *not* evidence of compliance: this repository hoists across workspaces just as
  Okven does, so a package importing something declared only at the root or by a
  sibling will build, lint, and test cleanly while still shipping an incomplete
  manifest. Compliance MUST therefore be established by inspecting each package's
  imports against its own manifest, not inferred from CI passing. A known instance
  to resolve: `firebase-kit-admin` imports `node:crypto` and no package declares
  the Node type definitions — Okven's root does.
- **REQ-PKG-9:** Declared version ranges MUST NOT be widened to a major version
  the test suite has not been run against. Bringing a stale range forward is out
  of scope for this work.
- **REQ-PKG-9a:** `firebase-kit-client` MUST ship its `getsetdel` peer range as
  `^2.0.0`, unchanged. This is a deliberate, known-cost decision: `getsetdel` is
  published at 3.0.0, so a consumer already on v3 will hit a peer-resolution
  conflict. It is accepted in order to keep this work's delta from the existing
  Okven code as small as possible; migrating to `getsetdel` 3 is separate later
  work. The package READMEs MUST state the required `getsetdel` major so a
  consumer is not surprised by the conflict. This trade was put to the maintainer
  during the requirements stage and chosen deliberately; it is not an oversight
  inherited from the goals.

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
- **REQ-VER-5a:** When the previous version is the `0.0.1` bootstrap placeholder —
  that is, on the first real release and only then — the workflow MUST abort if
  the computed version is anything other than `1.0.0`. The check MUST run
  **before** the version-bump commit of REQ-PUB-7, not merely before publishing:
  aborting afterwards would leave the wrong version committed on `main` as the
  base for the next computation. A wrong version published once is permanent — npm
  forbids republishing — and REQ-PUB-10's recovery covers only partial publishes,
  not wrong-version ones, so the classification hedge in REQ-VER-5 is not
  sufficient on its own.
- **REQ-VER-6:** Each release MUST create a matching git tag and a GitHub release
  whose notes are the generated changelog for that version. Exactly one tag MUST
  be created per release, and it MUST be created **after** all three packages have
  published successfully — so a tag existing is evidence the whole release landed.
  It follows that a partially-failed release leaves no tag, and the authoritative
  record of the attempted version is the version-bump commit on `main`
  (REQ-PUB-7).
- **REQ-VER-6a:** Tags MUST be of the form `v<version>` (e.g. `v1.0.0`), and this
  MUST be the same format the changelog tooling scans for when determining the
  previous release. If the two diverge, every subsequent release regenerates its
  notes from the beginning of history.
- **REQ-VER-7:** The repository MUST NOT maintain a committed `CHANGELOG.md` —
  changelog content lives in the GitHub release notes.

## 5. Automated publishing

- **REQ-PUB-1:** A push to `main` MUST be the only trigger that publishes. There
  MUST NOT be a manual re-run trigger: per REQ-PUB-10 an unattended re-run cannot
  complete a partial release, and because the version bump is already on `main`
  (REQ-PUB-7) a re-run would compute a *new* version rather than retry the failed
  one. Recovery is the documented manual procedure, not a workflow trigger.
- **REQ-PUB-2:** A push to `main` containing no release-worthy conventional
  commits MUST complete without publishing anything and without creating a tag,
  and MUST NOT fail *for lack of a release*. It MUST still run and be gated by
  build, lint, and tests — since push-to-`main` is this repository's only CI, a
  non-releasing push is otherwise unchecked.
- **REQ-PUB-3:** A release MUST NOT publish unless the repository's build, lint,
  and full test suite (including emulator tests) all pass first.
- **REQ-PUB-4:** Publishing MUST authenticate through npm Trusted Publishing
  (OIDC). The repository MUST NOT require, store, or reference a long-lived npm
  token secret.
- **REQ-PUB-5:** Each publish MUST attach npm provenance. Provenance MUST be
  enabled by explicit configuration; it MUST NOT be assumed to come from the
  publishing tool's defaults.
- **REQ-PUB-6:** `firebase-kit-protocol` MUST be published before
  `firebase-kit-client` and `firebase-kit-admin`, so that neither dependent is on
  the registry referencing a protocol version that has not been published yet.
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
  one — so the repository MUST document a maintainer recovery procedure. It MUST
  cover: identifying the attempted version from the version-bump commit on `main`
  (not from a tag, which will not exist per REQ-VER-6); the two available routes —
  publishing the missing packages manually and then creating the tag and release,
  or abandoning that version and letting the next release move forward; and the
  facts that a version gap is acceptable and that republishing is not possible.

## 6. Bootstrap

- **REQ-BOOT-1:** Because npm cannot configure a trusted publisher for a package
  that does not yet exist, each of the three names MUST first exist on npm as a
  placeholder release before the automated pipeline can publish it.
- **REQ-BOOT-2:** Each placeholder MUST be version `0.0.1` and MUST contain only
  a `README.md` stating the package is coming soon, plus the minimum metadata npm
  requires to accept it. The root package MUST also be at `0.0.1`, since that is
  the version the release tooling reads to compute the next one (REQ-VER-4).
- **REQ-BOOT-2a:** The phase-1 workflow run MUST pass **end to end**, including any
  toolchain-setup steps, not merely its build/lint/test steps. The skeleton's
  configuration MUST therefore be consistent with a repository that contains no
  TypeScript sources and no tests: a build referencing package projects that do
  not exist yet, or a test runner that treats "no test files" as failure, MUST NOT
  be committed in that state. Any tool that a setup step interrogates — notably the
  Firebase emulator toolchain, whose setup resolves the installed `firebase-tools`
  version and fails when nothing declares it — MUST already be declared as a root
  development dependency in phase 1, even though nothing uses it until phase 2.
  That root declaration MUST persist into phase 2, where `firebase-kit-admin` also
  declares it per REQ-PKG-8; the emulator cache key is derived from the
  root-resolved version, so removing the root declaration later would break
  REQ-TEST-5.
- **REQ-BOOT-2b:** The placeholder packages MUST declare no dependencies at all.
  A placeholder carrying a `workspace:` dependency would, if packed with the wrong
  tool, publish an uninstallable `0.0.1` permanently (REQ-TOOL-1a); declaring none
  removes the hazard outright.
- **REQ-BOOT-3:** The placeholder release MUST be publishable by the maintainer
  from a terminal — the system MUST NOT attempt to publish the placeholders
  itself. The maintainer instructions MUST give the exact command to run, MUST
  specify publishing `firebase-kit-protocol` first for the same dependency-order
  reason as REQ-PUB-6, and MUST state how the temporary token is supplied to the
  publisher for that one-off run. Leaving authentication unstated invites the
  npm-based workaround that REQ-TOOL-1a forbids.
- **REQ-BOOT-4:** The placeholder skeleton MUST reach `main` without `.mise/` ever
  being committed to `main`.
- **REQ-BOOT-5:** The first push to `main` MUST NOT attempt to publish, because
  trusted publishing is not yet configured at that point. This MUST be achieved by
  the commit being non-release-worthy, not by disabling or omitting the workflow.
- **REQ-BOOT-6:** The work MUST stop after the placeholder skeleton is pushed and
  MUST NOT proceed to moving the real sources until the maintainer confirms the
  placeholders are published and the trusted publishers are configured.
- **REQ-BOOT-7:** The repository MUST include written maintainer setup
  instructions covering: publishing each placeholder in dependency order with the
  exact command; the exact values to enter when configuring each package's trusted
  publisher (repository `ericvera/firebase-kit`, workflow file `publish.yml`);
  revoking the temporary token afterwards; enabling the repository's
  "Allow auto-merge" setting, without which every automated dependency pull
  request stalls; and ensuring `main`'s protection settings permit the release
  workflow's own version-bump push (REQ-PUB-7), which otherwise fails every
  release before it publishes.
- **REQ-BOOT-8:** The release workflow file MUST be named `publish.yml`, and MUST
  NOT be renamed after the maintainer configures the trusted publishers against
  it.

## 7. Quality gates

- **REQ-QUAL-1:** The repository MUST provide a single root command each for
  formatting, linting, building, and testing that covers all three packages, named
  exactly `yarn format`, `yarn lint`, `yarn build`, and `yarn test`. The names are
  fixed, not incidental: the project configuration records them as this
  repository's quality commands.
- **REQ-QUAL-2:** The repository MUST provide separate commands to run unit tests
  alone and emulator tests alone, named exactly `yarn test:unit` and
  `yarn test:emulator`, plus `yarn test` running both.
- **REQ-QUAL-3:** The full test command MUST run both unit and emulator tests.
- **REQ-QUAL-3a:** The root test commands MUST cover every package that has tests
  while preserving each package's own test setup — its setup files, its mock reset
  behavior, and the directory each package's test runner treats as its root. That
  last item is load-bearing and easy to lose: both packages deliberately anchor
  the runner at `src` so that `src/__mocks__/<module>` directories are discovered
  as automatic module shims. Anchoring at the package directory instead leaves the
  tests running while silently resolving the real modules rather than the shims.
- **REQ-QUAL-3c:** In the finished repository, a test command MUST fail if a
  package that has test files executes zero of them. The intended mechanism is
  structural, not a tolerance flag: a package with no tests
  (`firebase-kit-protocol`) simply has no test project declared, and the emulator
  command targets only the package that has emulator tests
  (`firebase-kit-admin`) — under which the runner's default "no tests is a
  failure" behavior already enforces this everywhere it applies. A repository-wide
  "pass with no tests" setting MUST NOT be left enabled in the finished
  repository, because it would mask a runner misconfiguration introduced during
  the move and let the release gate pass green having executed none of the suite.
- **REQ-QUAL-3d:** REQ-QUAL-3c binds the phase-2 repository. Phase 1 has no tests
  at all, so whatever accommodation makes REQ-BOOT-2a's skeleton run pass MUST be
  removed as part of phase 2 rather than left in place.
- **REQ-QUAL-3e:** The two packages' test runners are shaped differently today —
  `firebase-kit-admin` declares named unit and emulator projects, while
  `firebase-kit-client` declares a single unnamed one. The root commands and the
  package configurations MUST be reconciled so that both root commands select
  every applicable package's tests. A root command that selects by an exact
  project name would match nothing in `firebase-kit-client` and silently skip its
  entire suite. Note that project names must be unique across the workspace, so
  the client cannot simply reuse the admin package's project name; the
  reconciliation must be by distinct names with pattern selection, or by not
  selecting on name at all.
- **REQ-QUAL-3b:** The emulator test command MUST preserve every element of the
  existing emulator invocation, each of which is load-bearing and none of which
  may be dropped silently: `firebase-kit-admin`'s package-local emulator
  configuration in full (all four ports, single-project mode off, emulator UI
  off) and its Firestore rules, the `demo-admin-tests` project id, the restriction
  to the auth and firestore emulators only, and the fixed `TZ=Etc/Universal`
  timezone the tests are written against. The existing invocation passes no
  explicit config path and so depends on running with the admin package as the
  working directory; a root-level command MUST reproduce that. The auth and
  firestore host/port pair is additionally duplicated in the emulator test setup
  file and MUST stay in agreement with the emulator configuration.
- **REQ-QUAL-4:** Linting MUST apply the same type-aware strict configuration the
  maintainer's other library repositories use — recommended plus
  `strictTypeChecked` plus `stylisticTypeChecked`, together with the local rules:
  `curly`, `line-comment-position: above`, `max-len` of 80 for comments only,
  `prefer-function-type` off, `no-unused-vars` as an error with rest-siblings
  ignored, and no `describe` wrappers in test files. The repository MUST lint
  clean.
- **REQ-QUAL-4a:** Lint findings MUST be resolved by changing the code. Turning a
  rule off, downgrading it to a warning, and introducing file- or line-level
  suppression comments are all forbidden. A finding that appears to genuinely
  require a suppression MUST be raised to the maintainer as a blocker, and the work
  MUST NOT be reported complete with an unresolved one outstanding. The ban itself
  is checkable: the moved sources carry no `eslint-disable` comments today, so the
  finished tree MUST contain none either. Type assertions used to silence a
  finding (`as`, `as unknown as`, non-null assertions) count as suppression for
  this purpose and are equally forbidden — they are the loophole a
  comment-only ban would leave open, and they defeat the type checking the
  stricter rules exist to provide.
- **REQ-QUAL-5:** The build MUST type-check all three packages under the
  strictest shared TypeScript base configuration the maintainer's other library
  repositories use (`@tsconfig/strictest`), and MUST emit type declarations that
  consumers can use.
- **REQ-QUAL-5a:** Emitted declarations MUST retain doc comments, so consumers
  get documentation in editor tooling. The Okven tsconfigs strip them
  (`removeComments: true`) and MUST NOT be carried over in that state.
- **REQ-QUAL-6:** Committing MUST format and lint staged files automatically.
- **REQ-QUAL-6a:** Formatting MUST be configured identically to the maintainer's
  other library repositories (two-space indent, no semicolons, single quotes), so
  the moved sources reformat consistently rather than churning on first commit.
- **REQ-QUAL-6b:** The three packages MUST be wired as TypeScript project
  references, with `firebase-kit-client` and `firebase-kit-admin` referencing
  `firebase-kit-protocol`. This is what orders a root incremental build correctly
  and what lets the lint configuration resolve types across packages.
- **REQ-QUAL-7:** The repository MUST NOT carry lifecycle scripts that are inert
  under its own toolchain. Specifically, the sibling repositories' hook-disabling
  scripts (`prepublishOnly` / `postpublish` running `pinst`) MUST NOT be copied
  over: Yarn does not run npm's `prepublishOnly` lifecycle, and the root package
  is private and never published, so they would be dead configuration that
  misleads a future reader into thinking hook suppression is handled.

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
- **REQ-TEST-5:** Any CI job that runs the emulator tests MUST provision a Java 21
  runtime and MUST cache the emulator binaries, keyed on the resolved
  `firebase-tools` version, so they are not re-downloaded on every run while that
  version is unchanged. This applies to the release workflow and to the automated
  dependency-update checks alike.
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
- **REQ-DOC-6a:** The verification consumer project MUST install all three packed
  tarballs together, wired so that `firebase-kit-client` and `firebase-kit-admin`
  resolve `firebase-kit-protocol` from the **packed tarball** rather than from the
  registry. Without this the verification fails for an irrelevant reason: during
  phase 2 the packed version is still `0.0.1`, which on the registry is the
  content-free bootstrap placeholder, so every dependent's snippets would fail to
  resolve protocol regardless of whether the code under test is correct.
- **REQ-DOC-6:** Some examples cannot execute standalone — `firebase-kit-admin`'s
  entry points need a live emulator and an initialized admin app, and
  `firebase-kit-client`'s need an IndexedDB implementation. Those blocks MUST
  still be verified against the published surface by type-checking them in the
  throwaway consumer project rather than running them, and the verification record
  MUST say which blocks were type-checked instead of executed.

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

- **REQ-GUARD-1:** A `.mise/` directory reaching `main` MUST cause the release
  workflow run to fail and MUST prevent that run from publishing anything.
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
- **Seven requirements deliberately deviate from the scdate template**, which the
  goals had assumed could be copied verbatim. Each was checked against scdate
  rather than presumed: REQ-DEP-4 (scdate auto-merges npm majors), REQ-PUB-5
  (scdate publishes with no provenance, because `yarn npm publish` does not
  enable it by default), REQ-PUB-8 (scdate sets `cancel-in-progress: true`),
  REQ-PKG-3a and REQ-PKG-7 (no scdate package carries a `LICENSE` **file**, a
  `description`, or a `repository.directory` — note that scdate's packages *do*
  declare a `license` field and a `repository` object, so only those three items
  are deviations), REQ-QUAL-5a (scdate keeps doc comments in declarations while
  the Okven tsconfigs strip them — here scdate is the one being followed and Okven
  the one being departed from), and REQ-QUAL-7 (scdate carries `pinst`
  publish-lifecycle scripts that are inert under Yarn).
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
