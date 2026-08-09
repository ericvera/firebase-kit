# Implementation Plan

## Summary

Turn the empty `/Users/eric/Code/firebase-kit` repository into a published,
auto-publishing Yarn 4 monorepo for the three `firebase-kit-*` packages that
currently live as workspaces inside Okven. The repository is modeled on
`ericvera/scdate`: lockstep versions, a push-to-`main` release workflow, and npm
Trusted Publishing over OIDC with no long-lived token.

The work is split by a **hard stop**. npm cannot configure a trusted publisher
for a package that does not yet exist, so phase 1 ships a placeholder skeleton,
the maintainer publishes those placeholders and configures OIDC, and only then
does phase 2 move the real sources in.

## Design

### Repository layout

```
firebase-kit/
  .github/
    actions/setup-firebase-tools/action.yml   # Java 21 + emulator binary cache
    workflows/publish.yml                     # the ONLY release trigger
    workflows/dependabot.yml                  # auto-merge, non-major only
    dependabot.yml                            # npm + github-actions, weekly
  .husky/pre-commit                           # yarn lint-staged
  .yarn/releases/yarn-4.18.0.cjs              # committed
  .yarn/plugins/@yarnpkg/plugin-after-install.cjs
  packages/
    firebase-kit-protocol/                    # no deps, no tests
    firebase-kit-client/                      # -> protocol
    firebase-kit-admin/                       # -> protocol; emulator tests
  eslint.config.mjs  tsconfig.json  tsconfig.eslint.json  vitest.config.ts
  package.json (private, @firebase-kit/monorepo, workspaces: packages/*)
  LICENSE  README.md  MAINTAINERS.md
```

### Release pipeline

```
push to main
  │
  ├─ yarn install --immutable
  ├─ yarn build ─→ yarn lint ─→ yarn test        (build first: typed lint
  │                                                needs project refs built)
  ├─ GUARD: fail if .mise/ is tracked             ← after gates, before release
  ├─ conventional-changelog-action  (computes version only;
  │    skip-commit / skip-tag / git-push all off)
  │    prev version comes from the newest git tag, NOT package.json
  │      └─ skipped == 'true'  ─→ run ends green, nothing published
  ├─ GUARD: if prev tag is v0.0.1, computed version MUST be 1.0.0
  │                                                ← BEFORE the bump commit
  ├─ yarn workspaces foreach --all version <v> --deferred ; yarn version apply --all
  ├─ commit "chore(release): v<v> [skip ci]"       ← bump lands before publish
  ├─ publish protocol ─→ publish client ─→ publish admin   (order is required)
  └─ create tag + GitHub release                   ← only after all three land
```

Two ordering choices carry the failure semantics:

- **The bump commit precedes publishing**, so the repository's recorded version
  is always at or ahead of npm — never behind. A partial failure is therefore
  diagnosable from `main`'s history.
- **The tag is created last**, so a tag existing means the whole release landed.
  A partially-failed release leaves no tag, and `MAINTAINERS.md` documents
  recovery from the bump commit.

`firebase-kit-protocol` must publish first: both dependents carry a
`workspace:*` dependency that Yarn rewrites to an exact `1.0.0` at pack time, so
publishing a dependent first would put a package on the registry referencing a
protocol version nobody can install.

### Why `yarn npm publish` and not `npm publish`

Yarn's packer rewrites the `workspace:` protocol to a concrete version; npm's
does not. An npm-packed `firebase-kit-client` would ship a literal
`"firebase-kit-protocol": "workspace:*"` and be uninstallable. Yarn 4.18.0
implements npm's OIDC token exchange natively, so Trusted Publishing and the
workspace rewrite are available together. This constraint governs the release
pipeline, the manual bootstrap publishes, and the `yarn pack` verification.

### Versioning: `0.0.1` → `1.0.0`

Placeholders publish at `0.0.1`, and the bootstrap commit is **tagged `v0.0.1`**.
The tag is not decoration — it is where the version actually comes from. Because
this pipeline configures the release action not to create its own release commit,
the action ignores `package.json` entirely and derives the previous version from
the newest matching git tag, reporting none when no tag exists. Its
`fallback-version` input has no default, so with no tag the first release would
compute a hardcoded `0.1.0` no matter what the commit message said.

Given the seed tag, the action computes `semver.inc('0.0.1', releaseType)` with
no special handling for `0.x`, and its default `angular` preset classifies a
`BREAKING CHANGE:` footer as `major` — so `0.0.1` → `1.0.0`. The footer form is
required; `feat!:` exclamation detection is unreliable in that preset. A guard
aborts the run if the computed version is not `1.0.0` on that first release,
because a wrong version published once is permanent.

### Test orchestration

The three packages have mismatched runners: `admin` declares named `unit` and
`emulator` projects, `client` declares a single unnamed one, `protocol` has no
runner at all. The root commands invoke the runner **once per package** rather
than once across the workspace, because "no tests ran" is evaluated once per
run — a single workspace-wide run where `client` contributes zero files and
`admin` contributes 180 would still exit 0, silently losing 149 tests.

`test:unit` covers `client` + `admin`; `test:emulator` covers `admin` only;
`test` runs both. `protocol` is excluded from both by having no test project,
not by a tolerance flag.

### Phase 1 runs outside the mise pipeline

Phase 1 is authored directly on `main`. This is a deliberate exception to mise's
one-piece-of-work-at-a-time rule: the alternative — merging the skeleton from
the feature branch — would put `.mise/` on `main` and trip the repository's own
guard. The mise work in flight covers phase 2 only.

## Assumptions

- **The Okven repository is never touched.** Its copies of the three packages
  stay exactly where they are, so Okven keeps building and its
  `scripts/test-emulator-run.ts` keeps finding `firebase-kit-admin`'s
  `ci:test-emulator`. Repointing Okven at the published versions is separate
  later work.
- **Sources are copied, not moved,** and are copied verbatim. The only source
  edits in this plan are those the stricter lint configuration forces
  (task 2.2, 2.3) and the `removeComments` tsconfig change.
- **The `America/Puerto_Rico` test-timezone fossil is left alone.** It is a fixed
  timezone in `admin`'s test utilities, not a product coupling — the tests assert
  against it and changing it is behavior change the requirements exclude. Task
  2.3 records it rather than fixing it.
- **The emulator port numbers stay as they are.** They were chosen to avoid
  colliding with Okven's emulators; that constraint is gone after the move, but
  changing them means changing three files in lockstep for no benefit.
- **Phase 1's `build` and test commands are stubs.** A solution `tsconfig.json`
  with an empty `files` list and an empty `references` array does not compile — it
  fails with `TS18002` — and there are no tests to run. Task 1.1 makes all four
  commands trivially green and task 2.1 replaces them with the real project build
  and per-package test orchestration; REQ-QUAL-3d forbids leaving the phase-1
  shapes in place.

## Phases

- **Phase 1: Skeleton and placeholders (on `main`, outside mise)** — a complete,
  green, publishable-shaped repository containing no package source, pushed to a
  new public GitHub repo. Ends at the maintainer hard stop.
- **Phase 2: Move the packages (on the feature branch)** — copy each package in,
  wire the workspace, and bring each to a clean lint under the stricter config,
  one package per task so the tree is green at every point.
- **Phase 3: Publication readiness** — package metadata, documentation, and
  end-to-end verification through a real packed consumer.

## Phase Rationale

Phase 1 must complete and be pushed before the maintainer can do anything,
because configuring a trusted publisher needs the repository and the workflow
filename to exist. Within phase 1, the skeleton precedes the workflows (the
workflows reference scripts the skeleton defines), and the placeholders come
last because publishing them is the maintainer's first action after the stop.

Phase 2 moves `protocol` first: it is 133 lines with no dependencies and no
tests, and both other packages reference it through TypeScript project
references and a `workspace:*` dependency, so nothing else can build until it is
in place. `client` precedes `admin` because `admin` additionally drags in the
emulator toolchain, and doing the simpler lint fallout first calibrates the
harder one.

Phase 3 comes last because READMEs must describe the API as shipped, and the
packed-consumer verification needs all three packages present and building.

## Task Index

| File                            | Task                                                      | Phase | Requirements                                                                                                     |
| ------------------------------- | --------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------- |
| `01_01_repo_skeleton.md`        | Root toolchain, configs, and quality commands             | 1     | REQ-REPO-2, REQ-REPO-3, REQ-REPO-6, REQ-TOOL-1..7 (except 1a), REQ-QUAL-1, REQ-QUAL-4, REQ-QUAL-6, REQ-QUAL-6a, REQ-QUAL-7 |
| `01_02_release_workflow.md`     | `publish.yml`, dependency automation, guards              | 1     | REQ-PUB-1..10, REQ-VER-3, REQ-VER-5a, REQ-VER-6, REQ-VER-6a, REQ-VER-7, REQ-DEP-1..4, REQ-GUARD-1..3, REQ-TEST-5, REQ-BOOT-8 |
| `01_03_placeholders_and_docs.md`| Placeholder packages and maintainer documentation         | 1     | REQ-PKG-1, REQ-PKG-2, REQ-BOOT-1, REQ-BOOT-2, REQ-BOOT-2a, REQ-BOOT-2b, REQ-BOOT-3, REQ-BOOT-7, REQ-DOC-1, REQ-DOC-1a |
| `01_04_create_repo_and_stop.md` | Create the GitHub repo, seed `v0.0.1`, push, hand off     | 1     | REQ-REPO-5, REQ-BOOT-4, REQ-BOOT-5, REQ-BOOT-6, REQ-PUB-2, REQ-VER-5b                                            |
| `02_01_move_protocol.md`        | Copy `firebase-kit-protocol`; real build/lint/test wiring | 2     | REQ-REPO-1, REQ-REPO-3, REQ-PKG-6, REQ-QUAL-1, REQ-QUAL-2, REQ-QUAL-3, REQ-QUAL-3c, REQ-QUAL-3d, REQ-QUAL-3f, REQ-QUAL-5, REQ-QUAL-5a, REQ-QUAL-6b |
| `02_02_move_client.md`          | Copy `firebase-kit-client`; lint fallout; unit tests      | 2     | REQ-REPO-1, REQ-REPO-4, REQ-PKG-6, REQ-QUAL-3a, REQ-QUAL-3e, REQ-QUAL-4, REQ-QUAL-4a, REQ-TEST-1, REQ-TEST-2, REQ-TEST-6 |
| `02_03_move_admin.md`           | Copy `firebase-kit-admin`; emulator tests in CI           | 2     | REQ-REPO-1, REQ-REPO-4, REQ-PKG-6, REQ-QUAL-3a, REQ-QUAL-3b, REQ-TEST-1..6                                        |
| `02_04_dependency_manifests.md` | Audit and correct every package manifest                  | 2     | REQ-REPO-7, REQ-PKG-6, REQ-PKG-8, REQ-PKG-8a, REQ-PKG-9, REQ-PKG-9a, REQ-TOOL-7, REQ-BOOT-2a                      |
| `03_01_package_metadata.md`     | Publication metadata, per-package LICENSE, tarball shape  | 3     | REQ-PKG-3, REQ-PKG-3a, REQ-PKG-5, REQ-PKG-7                                                                      |
| `03_02_readmes.md`              | Root and per-package READMEs                              | 3     | REQ-DOC-1, REQ-DOC-2, REQ-DOC-3, REQ-DOC-4, REQ-DOC-5                                                            |
| `03_03_packed_verification.md`  | Verify through a real packed consumer project             | 3     | REQ-PKG-3, REQ-PKG-4, REQ-PKG-5, REQ-DOC-4, REQ-DOC-6, REQ-DOC-6a, REQ-TOOL-1a                                   |
| `03_04_release_readiness.md`    | Final reconciliation and the `1.0.0` release commit       | 3     | REQ-VER-1, REQ-VER-2, REQ-VER-4, REQ-VER-5, REQ-TEST-1, REQ-PUB-3                                                |
