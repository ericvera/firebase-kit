# Goals — publish the firebase-kit packages

## Original description

> this folder is intended to become a new repo for firebase-kit-x packages that exist in /Users/eric/Code/okven/packages. Help me publish that package so that later I can integrate it into the Okven project. I have a bunch of other packages that have publishing configured under my github account. I would like for this to auto-publish similarly.

## Objective

Turn `/Users/eric/Code/firebase-kit` (an empty git repo) into a published,
auto-publishing monorepo for the three `firebase-kit-*` packages currently
living as workspaces inside the Okven repo, modeled on the existing
`ericvera/scdate` monorepo.

## What ships

Three packages, moved from `/Users/eric/Code/okven/packages/`:

| Package                 | Source          | Tests                                                        | Notes                              |
| ----------------------- | --------------- | ------------------------------------------------------------ | ---------------------------------- |
| `firebase-kit-protocol` | 133 LOC, 3 files | none                                                          | shared types/constants; no deps    |
| `firebase-kit-client`   | ~5.9k LOC, 80 files | 29 test files, 149 `it()`                                  | depends on `firebase-kit-protocol` |
| `firebase-kit-admin`    | ~6.7k LOC, 147 files | 55 test files = **48 unit + 7 emulator**; 180 unit + 21 emulator `it()` | depends on `firebase-kit-protocol` |

**Extraction is clean — verified.** Every non-relative import across all three
packages resolves to a published npm package (`betterbe`, `firebase-admin`,
`firebase-functions`, `firestore-snapshot-utils`, `getsetdel`, `scdate-testing`,
`firebase`, `vitest`, `node:crypto`) or to `firebase-kit-protocol`. There are
**zero `@okv/*` imports**, so nothing in Okven blocks the move.

All three npm names are unregistered (registry returns 404).

## Reference implementation

`ericvera/scdate` is the template — a lockstep-versioned multi-package publishing
monorepo already working under this GitHub account. This repo copies its shape:

- Private root package (`@firebase-kit/monorepo`, `private: true`) with
  `workspaces: ["packages/*"]`; root and all packages share **one lockstep version**.
- `.github/workflows/publish.yml` on push to `main`:
  `conventional-changelog-action@v6` with `skip-commit`/`skip-tag`/`git-push`
  disabled so it only *computes* the next version and changelog →
  `yarn workspaces foreach --all version <v> --deferred` → `yarn version apply --all`
  → `git-auto-commit-action` → `npm install -g 'npm@>=11.5.1'` → one
  `yarn npm publish --access public` step per package (run from its directory)
  → `ncipollo/release-action`.
- Publishing uses **npm Trusted Publishing (OIDC)** — `id-token: write`, no
  `NPM_TOKEN` secret. `yarn npm publish` rewrites the `workspace:` protocol to the
  concrete version at pack time, so inter-package deps resolve correctly.
- `.github/workflows/dependabot.yml` auto-merge + `.github/dependabot.yml`
  covering both the `npm` and `github-actions` ecosystems.
- Root README listing the packages, plus a README per package.
- Yarn 4.18.0 (`nodeLinker: node-modules`, after-install plugin),
  husky + lint-staged + pinst, prettier config in root `package.json`,
  `@tsconfig/strictest` per package with TypeScript project references,
  MIT `LICENSE`.

Ported from Okven rather than scdate: the
`.github/actions/setup-firebase-tools` composite action (Java 21 temurin +
`actions/cache` over `~/.cache/firebase/emulators`, keyed on the resolved
`firebase-tools` version), because this repo's test suite includes Firestore/Auth
emulator tests and scdate's does not.

## Decisions

1. **Lockstep versioning, single repo** — one version across root and all three
   packages, one tag per release, all three published every release. Follows
   scdate. `workspace:^` becomes `workspace:*` to match.
2. **First real release is `1.0.0`** — these already run in Okven production.
3. **GitHub repo**: public `ericvera/firebase-kit`, created as part of this work.
   The placeholder skeleton is authored **directly on `main`, outside the mise
   pipeline** (see Bootstrap below). This is what keeps `.mise/` off `main`: the
   skeleton is written on `main` rather than merged in from the feature branch,
   so the repo's own `.mise/` guard and the `CLAUDE.md` never-merge rule are both
   satisfied without an exception.
4. **Fresh copy, clean initial commit** — no `git filter-repo` extraction of
   Okven history.
5. **ESLint**: adopt scdate's config verbatim (`tseslint.configs.strictTypeChecked`
   + `stylisticTypeChecked`, plus the local rules: `curly`,
   `line-comment-position: above`, `max-len` 80 for comments only,
   `prefer-function-type: off`, and no `describe` wrappers in tests). Okven lints
   these files under the laxer `@nuxt/eslint-config`, so new errors are expected;
   they get fixed rather than suppressed. Verified: the tests already use the flat
   `it()` style — zero `describe(` occurrences across all three packages.
6. **Test scripts split**: `yarn test:unit`, `yarn test:emulator`, and
   `yarn test` running both. The publish workflow runs the full `yarn test`, so a
   release is gated on the emulator tests too.
7. **No separate PR CI workflow** — `publish.yml` on push to `main` is the gate,
   matching scdate and getsetdel. Dependabot PRs are covered by
   `dependabot.yml`.
8. **Placeholders publish at `0.0.1`; the first real release reaches `1.0.0` via a
   `BREAKING CHANGE:` footer — driven by a seeded `v0.0.1` git tag, not by
   `package.json`.** Verified against the action's source, in two steps, the
   second of which corrects the first:
   - `src/helpers/bumpVersion.js` computes `semver.inc(version, releaseType)` with
     no 0.x special-casing, and the default `angular` preset returns `major` for a
     breaking change, so `0.0.1` → `1.0.0`.
   - **But `src/index.js` only reads `package.json` when `skip-commit` is
     false.** With `skip-commit: 'true'` — which the scdate template uses and this
     repo copies — it branches to the *git* strategy, and `src/version/git.js`
     takes the previous version from the newest matching git tag, or `null` when
     none exists. `fallback-version` has no default, so with no tags the first
     release would land on a hardcoded `0.1.0`, ignoring the footer entirely.

   Therefore the bootstrap must also **create and push a `v0.0.1` tag** (the
   action's default tag prefix is `v`). With that tag present the git strategy
   reports `0.0.1`, the footer classifies the bump as major, and the result is
   `1.0.0`. The footer form is still required — `feat!:` exclamation detection is
   unreliable in that preset (TriPSs/conventional-changelog-action#124). If the
   footer route misbehaves, the action's `pre-changelog-generation` hook
   (`preVersionGeneration`) is a deterministic fallback.

### Deliberate deviations from scdate

scdate is the template, but it is not copied verbatim. Each of these was assumed
during the goals round to be inherited from the template and turned out not to be:

- **Dependabot major updates do not auto-merge.** scdate's condition auto-merges
  npm majors and excludes only GitHub Actions majors. This repo excludes all
  majors.
- **npm provenance is enabled explicitly.** scdate has no provenance anywhere —
  `yarn npm publish` does not enable it by default the way `npm publish` does, so
  it must be turned on in configuration rather than inherited.
- **A release run in progress is never cancelled.** scdate sets
  `cancel-in-progress: true`, which would abort a run mid-publish and strand some
  packages published and others not.
- **Each package carries its own `LICENSE`, `description`, and
  `repository.directory`.** scdate has none of these; a root `LICENSE` is not
  copied into a subpackage tarball, and without the other two the npm page shows
  no summary and links to the monorepo root.
- **Doc comments are preserved in emitted declarations.** The Okven tsconfigs set
  `removeComments: true`, which would strip doc comments from published `.d.ts`
  and break consumer intellisense. scdate deliberately sets it to `false`; this
  repo follows scdate, not Okven.

## Bootstrap sequence (has a hard stop)

npm cannot configure a trusted publisher for a package that does not yet exist —
the setting lives in an existing package's settings page on npmjs.com
(npm/cli#8544 tracks lifting this). All three names are unregistered, so each
needs one manual publish before OIDC can take over.

**Phase 1 — placeholder skeleton. Authored directly on `main`, OUTSIDE the mise
pipeline**, so that `.mise/` never reaches `main`:

1. Create the public `ericvera/firebase-kit` GitHub repo.
2. On `main`, build the repo skeleton: root `package.json`, Yarn 4, tsconfig,
   eslint, prettier, husky, `.gitignore`, `LICENSE`, root `README.md`,
   `.github/workflows/publish.yml`, `.github/workflows/dependabot.yml`,
   `.github/dependabot.yml`, `.github/actions/setup-firebase-tools`.
3. Add three **placeholder packages** at version `0.0.1`, each containing only a
   minimal publishable `package.json` and a `README.md` saying the package is
   coming soon.
4. Tag the bootstrap commit `v0.0.1` and push both the branch and the tag. The
   tag is what the release tooling reads as the previous version (decision 8);
   without it the first real release computes `0.1.0` instead of `1.0.0`.
   Push `main`. The commit must be non-releasing (a `chore:` subject) so
   `conventional-changelog-action` reports `skipped == 'true'` and every publish
   step no-ops — OIDC is not configured yet and a publish attempt would fail.
   The skeleton's build, lint, and test configuration must be consistent with its
   own (source-free) contents so this run passes rather than failing on an empty
   repository. That makes it a **partial** rehearsal: it proves the workflow
   parses, installs, and reaches its gates on a runner. It does **not** exercise
   the emulator path, which has no tests to run until phase 2.
5. Rebase the mise feature branch onto the new `main`.

**STOP — handed to Eric:**

6. Publish the three placeholders manually with a temporary npm token.
7. Configure the trusted publisher for each package on npmjs.com
   (`ericvera/firebase-kit`, workflow file `publish.yml`), then revoke the
   temporary token.

**Phase 2 — real release (this work resumes after explicit confirmation):**

8. On the mise feature branch: copy the three packages' sources in, wire the
   workspace/tsconfig/vitest configuration, fix the ESLint fallout, write the
   per-package READMEs.
9. Close out: delete `.mise/`, then squash-merge to `main` with a conventional
   subject carrying a `BREAKING CHANGE:` footer. The workflow publishes **1.0.0**
   of all three, in dependency order, and cuts the GitHub release.

### Decisions taken during the requirements stage

Two dependency-metadata questions surfaced after this document was first approved
and were decided with the maintainer. Both are recorded here so the goals and the
requirements do not contradict each other:

9. **`firebase-kit-client` ships its `getsetdel` peer range unchanged at
   `^2.0.0`,** even though `getsetdel` is published at 3.0.0 and a consumer on v3
   will hit a peer-resolution conflict. Chosen to keep this work's delta from the
   existing Okven code minimal; migrating to `getsetdel` 3 is separate later work.
10. **`firebase-kit-admin`'s `betterbe` peer becomes required** (it is currently
    optional). It has a runtime value import reachable from `./validation`, a
    production entry point, so an optional declaration gives a consumer no
    install-time warning and a module-resolution failure at runtime.
    `firestore-snapshot-utils` and `vitest` stay optional: their runtime imports
    are reachable only from the test-support entry points `./testing` and
    `./mocks`, which is exactly what an optional peer is for.

This narrows the Out of scope clause below: these two are deliberate metadata
changes, not incidental ones.

## Out of scope

- **All changes to the Okven repo.** Swapping Okven's `workspace:^` dependencies
  for the published npm versions and deleting `okven/packages/firebase-kit-*` is
  separate, later work — explicitly deferred by the request ("so that later I can
  integrate it into the Okven project").
- Any change to package public API, behavior, or test content beyond what the
  stricter ESLint config forces.
- Publishing anything to npm on my part — every npm publish in phase 1 is Eric's,
  and every publish in phase 2 is the workflow's.

## Assumptions

- Repo name `firebase-kit`, public, MIT, under `ericvera` — matches the directory
  name and every sibling library repo.
- Package names stay unscoped (`firebase-kit-protocol` / `-client` / `-admin`),
  since all three are available.
- Phase 1 runs outside the mise pipeline, on `main`. This is a deliberate
  exception to mise's one-piece-of-work-at-a-time rule, taken because the
  alternative — merging the skeleton from the feature branch — would put `.mise/`
  on `main` and trip the repo's own guard. The mise work in flight covers phase 2
  only.
- `firebase-kit-admin`'s existing `firebase.json` (emulator ports) and
  `firestore.rules` move with the package.
- The repo adds a guard that fails the workflow if a `.mise/` directory reaches
  `main`, ported from Okven's `pr-checks.yml` — this repo uses mise and ships by
  squash-merging to `main`, where that guard has no PR to run on.

## Risks

- **ESLint fallout volume is unmeasurable until the repo installs.** ~13k LOC
  written under a laxer config moving to `strictTypeChecked`. The plan stage
  surfaces the count before any fixing starts.
- **Emulator tests gate every release.** Java + the emulator download run on each
  push to `main`; the cache action mitigates the download but not the runtime.
