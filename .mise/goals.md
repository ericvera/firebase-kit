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

| Package                | Size                            | Notes                                  |
| ---------------------- | ------------------------------- | -------------------------------------- |
| `firebase-kit-protocol` | 133 LOC, 0 tests                | shared types/constants; no deps        |
| `firebase-kit-client`   | ~5.9k LOC, 29 tests             | depends on `firebase-kit-protocol`     |
| `firebase-kit-admin`    | ~6.7k LOC, 55 tests + 7 emulator | depends on `firebase-kit-protocol`     |

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
3. **GitHub repo**: public `ericvera/firebase-kit`, created and pushed as part of
   this work.
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

## Bootstrap sequence (has a hard stop)

npm cannot configure a trusted publisher for a package that does not yet exist —
the setting lives in an existing package's settings page on npmjs.com
(npm/cli#8544 tracks lifting this). All three names are unregistered, so each
needs one manual publish before OIDC can take over.

**Phase 1 — placeholder release (this work, up to the stop):**

1. Create the public `ericvera/firebase-kit` GitHub repo.
2. Build the repo skeleton: root `package.json`, Yarn 4, tsconfig, eslint,
   prettier, husky, `.gitignore`, `LICENSE`, root `README.md`,
   `.github/workflows/publish.yml`, `.github/workflows/dependabot.yml`,
   `.github/dependabot.yml`, `.github/actions/setup-firebase-tools`.
3. Add three **placeholder packages** at version `0.0.1`, each containing only a
   minimal publishable `package.json` and a `README.md` saying the package is
   coming soon.
4. Push to `main`. The initial commit must be non-releasing (a `chore:` subject)
   so `conventional-changelog-action` reports `skipped == 'true'` and the publish
   steps no-op — OIDC is not configured yet and a publish attempt would fail.

**STOP — handed to Eric:**

5. Publish the three placeholders manually with a temporary npm token.
6. Configure the trusted publisher for each package on npmjs.com
   (`ericvera/firebase-kit`, workflow file `publish.yml`), then revoke the
   temporary token.

**Phase 2 — real release (resumes after confirmation):**

7. Copy the three packages' sources in, wire the workspace/tsconfig/vitest
   configuration, fix the ESLint fallout, write the per-package READMEs.
8. Merge to `main` with conventional commits; the workflow publishes **1.0.0** of
   all three and cuts the GitHub release.

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
- Placeholders publish at `0.0.1` so the first real release can be `1.0.0`. The
  exact mechanism for making `conventional-changelog-action` land on `1.0.0`
  rather than `0.1.0` (a breaking-change footer, a seeded tag, or a one-time
  version pin) is a plan-stage detail; if no clean mechanism exists, that is a
  blocker to raise, not a silent downgrade to `0.1.0`.
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
