# Progress

## 1.1 — Yarn 4 monorepo skeleton with green quality commands (committed on `main`, not this branch)

- Work commit: `35e43e3` on `main`. Per the task's Background this phase is
  deliberately outside the mise workflow — merging it from this branch would put
  `.mise/` on `main` and trip the guard task 1.2 adds.
- Key changes (all new, all on `main`): `package.json` (private
  `@firebase-kit/monorepo` 0.0.1, `workspaces: ["packages/*"]`, prettier and
  lint-staged blocks, `packageManager: yarn@4.18.0`, root devDependencies for
  eslint / @eslint/js / typescript-eslint / typescript / @tsconfig/strictest /
  prettier / vitest / husky / lint-staged / @types/node), `.yarnrc.yml`,
  `.yarn/releases/yarn-4.18.0.cjs` (755), `.yarn/plugins/@yarnpkg/plugin-after-install.cjs`,
  `yarn.lock`, `tsconfig.json`, `tsconfig.eslint.json`, `eslint.config.mjs`,
  `vitest.config.ts`, `.gitignore`, `.editorconfig`, `.prettierignore`,
  `.husky/pre-commit`, `.vscode/extensions.json`, `.vscode/settings.json`,
  `LICENSE`, `README.md`.
- `build`, `test`, `test:unit`, `test:emulator` are phase-1 stubs that echo and
  exit 0, marked by a `-- STUBS: ... --` key in the scripts block. `tsconfig.json`
  has an empty `references` array. Task 2.1 replaces the stubs with the real
  project build and per-package test orchestration.
- No `pinst` / `prepublishOnly` / `postpublish` scripts. `.mise/` is not
  gitignored.

### Deviations from plan

- **`eslint.config.mjs` omits `'./tsconfig.json'` from
  `parserOptions.project`.** The task specified all three entries, but the same
  `TS18002` that makes the empty solution tsconfig uncompilable also makes every
  typed-lint parse fail (`Parsing error: Unable to parse the specified 'tsconfig'
  file`), so `yarn lint` could not be green alongside the required empty
  `references`. A comment at that site says to add the entry back once the first
  package reference exists — do this in task 2.1 together with the real `build`.
- `LICENSE` copyright year is `2026` rather than scdate's `2024`.
- Root `package.json` keeps no `keywords` (scdate's are scdate-specific and this
  root is private and unpublished).

### Verification

- `yarn install --immutable`, `yarn format`, `yarn lint`, `yarn build`,
  `yarn test`, `yarn test:unit`, `yarn test:emulator` all exit 0.
- Clean-clone check: cloned `main` to a scratch dir, `yarn install --immutable`,
  then all six commands exit 0; working tree stayed clean after `yarn format`.
- `git check-ignore -v .mise` reports no match. `git ls-files .yarn` lists
  exactly the release binary and the after-install plugin.
- Pre-commit hook fired on the work commit and ran lint-staged over all 17 files.
- End-to-end tests: none. The project's test exception for library packages with
  no e2e infrastructure applies; the clean-clone quality run above is the
  substitute verification.

## 1.2 — Release workflow, dependency automation, and guards (committed on `main`, not this branch)

- Work commit: `aea5525` on `main`. Same deliberate exception as 1.1: the work
  lives on `main` because the `.mise/` guard this task adds would fail any run
  where `.mise/` reaches `main`.
- Key changes (all new, all on `main`):
  - `.github/workflows/publish.yml` — push-to-`main`-only trigger, no manual
    dispatch; `concurrency` group `${{ github.ref }}` with
    `cancel-in-progress: false`; permissions exactly `contents: write` +
    `id-token: write`; checkout `fetch-depth: 0`; Node 24 with
    `registry-url: https://registry.npmjs.org`. Step order: `yarn install
    --immutable` → `yarn build` → `yarn lint` → `./.github/actions/setup-firebase-tools`
    → `yarn test` → `.mise/` guard → `TriPSs/conventional-changelog-action@v6`
    (id `changelog`) → `1.0.0` guard → `yarn workspaces foreach --all version …
    --deferred` → `yarn version apply --all` →
    `stefanzweifel/git-auto-commit-action@v7` (`chore(release): v<version>
    [skip ci]`) → publish protocol/client/admin → `ncipollo/release-action@v1`.
  - `.github/actions/setup-firebase-tools/action.yml` — ported verbatim from
    `/Users/eric/Code/okven`: Java 21 temurin, `yarn info firebase-tools
    --name-only --json` into a step output, `actions/cache@v5` on
    `~/.cache/firebase/emulators`.
  - `.github/dependabot.yml` — scdate's config copied verbatim (weekly npm at
    `/` and github-actions at `/`, groups `dev-non-major`, `prod-non-major`,
    `actions-non-major`).
  - `.github/workflows/dependabot.yml` — auto-merge with the three specified
    deviations: majors excluded for **all** ecosystems
    (`startsWith(update-type, 'version-update:semver') && update-type !=
    'version-update:semver-major'`), build → lint → emulator setup → test
    order, and `yarn install --immutable`.
- The five deviations from the scdate template are all in place:
  `cancel-in-progress: false`, explicit `--immutable` in both workflows,
  `--provenance` on all three publish steps, all-ecosystem major exclusion in
  dependabot auto-merge, and the emulator setup action in the dependabot
  workflow. scdate's `npm install -g npm@…` step was intentionally not carried
  over, and scdate's dependabot lint-before-build ordering was not copied.
- Guard implementations: the `.mise/` guard is unconditional (so it fails a
  non-releasing push too) and runs `git ls-files -- '.mise/' '**/.mise/'`,
  emitting `::error::` and exiting 1. The `1.0.0` guard is gated on
  `steps.changelog.outputs.skipped == 'false'` and only aborts when
  `jq -r '.version' package.json` is `0.0.1` **and** the computed version is not
  `1.0.0`.
- `fallback-version` is not set. No `CHANGELOG.md` is produced
  (`output-file: 'false'`); the release body is
  `steps.changelog.outputs.clean_changelog`.

### Deviations from plan

- None functionally. Two implementation choices worth recording: the computed
  version is passed to `run:` steps through a `COMPUTED_VERSION` env var rather
  than interpolated directly into the shell (avoids expression-into-shell
  injection; behaviour is identical), and the `1.0.0` guard reads the current
  version with `jq` rather than `node -p` (the root `package.json` sets
  `"type": "module"`, which makes `node -p "require(...)"` ambiguous).

### Verification

- `actionlint` 1.7.12 (installed via Homebrew for this task; it was not present
  before) reports 0 errors across both workflow files, with its integrated
  shellcheck active. It does not lint composite action files, so
  `action.yml` and `.github/dependabot.yml` were additionally parsed as YAML —
  all four files parse clean.
- `yarn format` leaves all four files unchanged; `yarn lint`, `yarn build`,
  `yarn test`, `yarn test:unit` all exit 0.
- No npm token anywhere: `grep -rniE 'npm_token|NODE_AUTH_TOKEN|secrets\.NPM'`
  over the repo returns nothing. No `continue-on-error` and no `always()` in
  `.github/`.
- Four-scenario conditional trace: (a) push with no release-worthy commits —
  gates run, `.mise/` guard passes, changelog sets `skipped == 'true'`, every
  later step is skipped, run green with nothing published or tagged (this is the
  task 1.4 phase-1 push); (b) push carrying `.mise/` — guard exits 1 after the
  gates, changelog and everything after never run; (c) first real release
  computing `1.0.0` — `0.0.1` matches but `1.0.0 != 1.0.0` is false, so the
  guard passes and the full bump/publish/tag sequence runs; (d) first real
  release computing anything else — guard exits 1 before the bump, so no wrong
  version is committed to `main`.
- End-to-end tests: none — the project's test exception for consumer-facing
  wiring applies. The substitute verification is the `actionlint` run plus the
  four-scenario trace above; the workflow's first real execution is task 1.4.
- Known and expected: the emulator setup step will fail until task 1.3 adds the
  root `firebase-tools` devDependency, since `yarn info firebase-tools` errors
  when nothing declares it. This ordering is called out in the task's Gotchas.

## 1.2 (review fix) — Guard defects corrected (committed on `main`, not this branch)

- Work commit: `9c8445b` on `main`, subject `chore: correct release guard
  version source and .mise pathspec`. Deliberately a `chore:` subject — a
  release-worthy subject would compute a version and attempt a publish once
  `main` is pushed.
- Key changes: `.github/workflows/publish.yml` only, two steps.
  - **`1.0.0` guard read the wrong version source.** It used
    `jq -r '.version' package.json`, but with `skip-commit: 'true'` the
    changelog action takes the `skipVersionFile || skipCommit` branch and
    derives the previous version from git tags (`src/version/git.js` →
    `gitSemverTags`); `package.json` is never consulted by the computation.
    Traced failure: first release computes `1.0.0`, the bump commit lands,
    `firebase-kit-protocol@1.0.0` publishes, the client publish fails, and no
    tag exists yet because tagging is last. A recovery `fix:` push then reads
    tag `v0.0.1` → computes `0.0.2`, while the guard read `package.json` =
    `1.0.0` and stayed silent — publishing client and admin at `0.0.2` beside a
    published protocol at `1.0.0`.
    The guard now reads `steps.changelog.outputs.old_version` (new
    `PREVIOUS_VERSION` env var) and, whenever `skipped == 'false'`, aborts in
    **both** failure cases: `old_version` empty (no seed tag found, the case
    where the action silently falls back to a hardcoded version) and
    `old_version` = `0.0.1` with a computed version other than `1.0.0`. Each
    branch emits its own `::error::` naming the cause and what to check.
  - **`.mise/` guard pathspec matched nothing beyond the repo root.**
    `git ls-files -- '.mise/' '**/.mise/'` uses default pathspec magic, where
    the trailing-slash directory shorthand applies only to a literal prefix, so
    the second pattern was dead weight and a nested `.mise/` (plausible once
    packages land under `packages/`) would have reached a release. Both
    occurrences replaced with `':(glob)**/.mise/**'`.

### Deviations from plan

- The task file's step 9 and its checklist phrase the `1.0.0` guard as reading
  "the current version". That wording implies `package.json`, which is the
  defect. The guard now keys off the tag-derived `old_version` the computation
  actually uses, and additionally fires on an empty `old_version`. Intent
  (never let a first release be anything but `1.0.0`, and never publish off a
  silent fallback) is unchanged and strengthened.

### Verification

- Pathspec fix verified **empirically**, not by reasoning, in a scratch git
  repository holding root-level, nested, and deeply nested `.mise/` paths plus
  near-miss decoys:
  - old `'.mise/' '**/.mise/'` reported only `.mise/plan/x.md`, missing
    `sub/.mise/y.md` and `packages/foo/.mise/z.md`;
  - new `':(glob)**/.mise/**'` reported all five `.mise/` paths
    (`.mise/top.md`, `.mise/plan/x.md`, `sub/.mise/y.md`,
    `packages/foo/.mise/z.md`,
    `packages/bar/.mise/deep/nested/d.md`) and matched neither `notmise/f.md`
    nor `packages/misething.md`.
- `old_version` confirmed to exist as an output on `v6` despite being
  undocumented in that tag's `action.yml`: `src/index.js` calls
  `core.setOutput('old_version', …)` on both the skipped and non-skipped paths,
  and `src/version/git.js` sets it to `null` when `gitSemverTags` returns
  nothing — which surfaces as an empty string in the workflow expression.
- Guard shell logic executed directly over six input pairs: empty/`0.1.0` →
  exit 1; `0.0.1`/`1.0.0` → pass; `0.0.1`/`0.0.2` → exit 1; `0.0.1`/`0.1.0` →
  exit 1; `1.0.0`/`1.0.1` → pass; `1.2.0`/`2.0.0` → pass.
- `actionlint` 1.7.12 reports 0 errors across both workflow files with its
  integrated shellcheck active. `yarn format` leaves the file unchanged;
  `yarn lint`, `yarn build`, `yarn test`, `yarn test:unit` all exit 0.
- The four-scenario trace still holds: (a) non-releasing push — `skipped ==
  'true'`, guard skipped, run green; (b) push carrying `.mise/` at **any**
  depth — guard exits 1 before the changelog step; (c) first real release with
  tag `v0.0.1` computing `1.0.0` — passes; (d) first real release computing
  anything else, or with no tag at all — exits 1 before the bump commit.
- Preserved throughout: `env:` rather than `${{ }}` interpolation inside
  `run:`, no `continue-on-error`, no `always()`, no npm token reference.
- End-to-end tests: none — the project's test exception for consumer-facing
  wiring applies; the substitute verification is the scratch-repository
  pathspec experiment, the guard-logic execution, and the `actionlint` run
  above.

## 1.3 — Placeholder packages, root `firebase-tools`, and `MAINTAINERS.md` (committed on `main`, not this branch)

- Work commit: `6f07c25` on `main`, subject `chore: add placeholder packages and
  maintainer documentation`. Same deliberate exception as 1.1/1.2 — phase 1 is
  authored on `main` because `.mise/` must never reach it, and a `chore:`
  subject keeps the task 1.4 push from computing a version and attempting a
  publish before OIDC is configured.
- Key changes (all on `main`):
  - `packages/firebase-kit-protocol/`, `packages/firebase-kit-client/`,
    `packages/firebase-kit-admin/` — each **exactly** `package.json` +
    `README.md`. Every manifest has the same six keys and nothing else: `name`,
    `version` `0.0.1`, `description`, `license` `MIT`, `repository`
    (`git+https://github.com/ericvera/firebase-kit.git` plus `directory:
    packages/<name>`), and `publishConfig.access` `public`. No `dependencies` /
    `devDependencies` / `peerDependencies` / `optionalDependencies`, no
    `exports` / `files` / `main` / `types`, no `scripts`, no `private`, no
    `engines`, no `type`, no `keywords`. The READMEs say the package is coming
    soon, state that the release is a placeholder containing no code, and link
    to the repository.
  - `package.json` — added `firebase-tools: "15.23.0"` to root devDependencies.
    Exact pin, matching what okven pins in both its root and its
    `firebase-kit-admin`; task 2.4 must reuse this exact string.
  - `yarn.lock` — the three workspaces plus the `firebase-tools` graph
    (+552 resolved packages).
  - `MAINTAINERS.md` (new) and `README.md` (now links to it and to the three
    package directories).
- `MAINTAINERS.md` structure: a top-level never-`npm publish` rule; **Bootstrap
  (one time)** in 7 numbered steps — temporary token (classic Automation, or a
  granular token scoped to *All packages*, since the three names do not exist
  yet and so cannot be selected individually) → publish protocol → client →
  admin with `yarn workspace <name> npm publish --access public`, the token
  supplied through `YARN_NPM_AUTH_TOKEN` via a `printf` + `read -rs` prompt →
  trusted publisher (`ericvera` / `firebase-kit` / `publish.yml` / environment
  empty) → revoke the token → "Allow auto-merge" → branch protection that
  permits the release workflow's own bump push → a confirmation checklist; then
  a short **How a release works** reference; then **Recovering a partially
  published release** — read the version from the `chore(release):` bump commit,
  determine which packages published, then Route A (finish by hand, then tag and
  `gh release create`) or Route B (abandon, tag anyway), both ending with a
  `v$VERSION` tag on the bump commit, plus the facts that republishing is
  impossible, that a version gap is acceptable, and that the `v0.0.1` seed tag
  must never be deleted.

### Deviations from plan

- **The recovery section reads the attempted version from the `chore(release):`
  bump commit, not from `package.json` and not from a tag**, matching the 1.2
  review correction: the changelog action derives the previous version from git
  tags, and the tag is created only after all three publishes, so a partial
  failure leaves no tag at all. The task file predates that correction.
- **Both recovery routes end by creating the `v$VERSION` tag on the bump
  commit**, including the "abandon this version" route. The task file describes
  Route B only as letting the next release move forward; the tag is the
  mechanism that makes that true, since without it the next run recomputes
  `$VERSION` from the older tag and fails again on the packages that already
  published it. The `v0.0.1` seed tag is called out separately as never-delete.
- One troubleshooting note was added that the task file does not mention: Yarn
  publishes through `https://registry.yarnpkg.com` (npm's proxy, the same path
  the workflow and the scdate template already use), with
  `YARN_NPM_PUBLISH_REGISTRY=https://registry.npmjs.org` documented as the
  fallback if a token is ever rejected there.
- The placeholder manifests deliberately omit `engines`, even though REQ-PKG-6
  will require `node >= 24` on the **real** packages. The task file enumerates
  the placeholder's fields exhaustively and `0.0.1` is permanent, so nothing
  beyond that list was added. Task 3.1 adds it.

### Verification

- `yarn install --immutable`, `yarn format`, `yarn lint`, `yarn build`,
  `yarn test`, `yarn test:unit`, `yarn test:emulator` all exit 0 with the three
  workspaces present. `yarn format` leaves every new file unchanged on a second
  pass.
- `yarn workspace <name> pack --dry-run` for all three lists exactly `README.md`
  and `package.json` and nothing else. `yarn workspace firebase-kit-protocol npm
  publish --dry-run --access public` reports the same two files.
- Manifest keys asserted programmatically against a forbidden-key list
  (`dependencies`, `devDependencies`, `peerDependencies`,
  `optionalDependencies`, `peerDependenciesMeta`, `exports`, `files`, `main`,
  `types`, `typings`, `scripts`, `bin`): zero hits on all three.
- `yarn info firebase-tools --name-only --json` returns exactly one line,
  `"firebase-tools@npm:15.23.0"`. Required: the composite action appends that
  output straight to `$GITHUB_OUTPUT`, so a second line would corrupt the
  emulator cache key.
- `yarn workspaces list --json` reports 4 workspaces (root plus the three).
- Lockfile churn audited rather than assumed: both the pre- and post-install
  `yarn.lock` were parsed into descriptor → resolution maps (201 → 919
  descriptors) and compared — **zero** changed resolutions and **zero** removed
  descriptors. `@types/node@npm:^24.13.3` still resolves to `24.13.3`; the new
  `26.2.0` entry belongs to firebase-tools' separate `>=13.7.0` descriptor.
- `read -rs` (the token prompt in `MAINTAINERS.md`) was executed under both
  `zsh` and `bash` to confirm portability — `read -p` is not portable, since
  zsh's `-p` means read from the coprocess.
- Cold read-through of `MAINTAINERS.md`: every command is copy-pasteable, all
  five in-document anchor links resolve to real headings, and one self-reference
  error (step 1 pointing at step 5 for token revocation instead of step 4) was
  found and fixed.
- End-to-end tests: none — the project's test exception for consumer-facing
  wiring applies. The substitute verification is the dry-run pack inspection,
  the manifest key assertion, and the cold read-through above; the publish path
  itself is exercised by the maintainer at the task 1.4 hard stop.

## 1.3 (review fix) — Bootstrap step 1 rewritten for granular npm tokens (committed on `main`, not this branch)

- Work commit: `c4e916b` on `main`, subject `chore: document granular npm token
  flow in MAINTAINERS.md`. `chore:` deliberately, for the same reason as the
  other phase-1 commits: a release-worthy subject would compute a version and
  attempt a publish on the task 1.4 push.
- Key changes: `MAINTAINERS.md` only, two places — bootstrap **step 1** and the
  `--otp` bullet in the notes under **step 2**. Nothing else in the repository.
- **The defect.** Step 1 offered a **Classic → Automation** token as the
  simplest/primary choice and a granular token as a fallback that "also works".
  Classic tokens no longer exist, so there is no such control on npmjs.com. This
  is the first step of the one procedure the maintainer runs cold, after this
  planning directory is deleted, so the gap has no in-repo recovery path.
- Step 1 now documents the granular flow as the only route: a field-by-field
  table (token name / **Bypass two-factor authentication** checked /
  Packages and scopes **Read and write** + **All Packages** / Organizations
  **No access** / shortest expiration) followed by three notes explaining the
  non-obvious choices — Bypass 2FA is off by default and is what makes the
  non-interactive publish possible; **All Packages** is *required*, not merely
  convenient, because "Only select packages and scopes" can list only existing
  packages and scopes you already own and all three names are unscoped and
  unpublished; and write-scoped tokens are capped at **90 days**, so there is no
  "no expiration" option (irrelevant here, since step 4 revokes the token
  minutes later).
- The `--otp <code>` guidance is kept as the recovery path but reworded off
  classic-token terminology — it now names the actual cause (the token was
  created without Bypass 2FA) and says to append `--otp` rather than start over.

### Deviations from plan

- None. The task file only requires step 1 to state "how the temporary npm token
  is supplied"; the token *type* was an implementation choice and this corrects
  it. The checklist item ("how the token is supplied") is still satisfied — that
  mechanism (`YARN_NPM_AUTH_TOKEN` via a `read -rs` prompt) is in step 2 and is
  untouched.

### Verification

- Registry facts checked against **current npm documentation**, not recollection
  and not the reviewer's summary, because these have moved repeatedly:
  - `docs.npmjs.com/about-access-tokens` states verbatim: "As of November 2025,
    only Granular access tokens are supported. Legacy access tokens have been
    removed." The GitHub changelog of 2025-12-09 confirms the revocation date
    and that classic tokens "can no longer authenticate, be recreated, or be
    recovered". Both reviewer dates hold.
  - Bypass 2FA confirmed in the docs source
    (`content/integrations/integrating-npm-with-external-services/`): the
    checkbox is labelled **"Bypass two-factor authentication"**, "is set to
    false by default at token creation", applies to tokens with write access,
    and takes precedence over account- and package-level 2FA for publishing.
    Also confirmed: the creation page has no token-type selector at all any
    more, and the field order in the new table matches the documented UI order.
  - **The 90-day cap is real but is not in npm's own docs** — the docs page says
    only "at least one day in the future". It is stated in the 2025-12-09
    changelog ("write tokens limited to 90 days maximum") and confirmed
    empirically in `npm/documentation` issue #1864, where the cap was initially
    unenforced in the UI (a token expiring in Oct 2027 was created in Jan 2026),
    then enforced from March 2026 with a warning chip and disabled calendar
    dates — and enforced **only for tokens with write access**; read-only tokens
    still take arbitrary dates. The document's wording says "for any token with
    write access" to match the actual behaviour rather than the changelog's
    looser phrasing. Flagged here because the docs and the UI disagree.
  - The "package-scoped tokens cannot create a new package" point is **not**
    stated anywhere in npm's docs. What the docs do state is that "Only select
    packages and scopes" selects from packages and scopes the account already
    has access to. The document is therefore worded from that documented
    mechanism (nothing to select, since the names are unscoped and unpublished)
    rather than asserting an undocumented registry rule.
  - Not carried in: the 2025-12-09 changelog advertises `npm token create` for
    granular tokens, but the current docs page still says "You cannot create
    granular access tokens from the CLI currently." Given the contradiction, the
    document sticks to the website flow, which both sources agree works.
- `yarn format` (leaves `MAINTAINERS.md` unchanged on re-run; prettier realigned
  the new table on the first pass and that alignment is what was committed),
  `yarn lint`, `yarn build`, `yarn test` all exit 0. The pre-commit hook ran
  lint-staged over the file.
- `git diff` on the work commit touches exactly one file and two hunks. All
  in-document anchor links still resolve — no heading was renamed, and the
  `[bootstrap step 2]` / `[bootstrap step 4]` cross-references still point at
  the steps they name.
- End-to-end tests: none — the project's test exception for consumer-facing
  wiring applies; the substitute verification is the documentation cross-check
  above plus a re-read of steps 1 through 4 as a continuous procedure.

## 1.4 — Public repository created, `main` and the `v0.0.1` seed tag pushed, pipeline rehearsed green, hard stop

- No repository files changed. This task created remote state and pushed
  existing commits; the only tracked change is this progress entry, on the
  feature branch.
- **Repository**: <https://github.com/ericvera/firebase-kit> — public, owner
  `ericvera`, description set, topics `firebase` / `firestore` / `typescript` /
  `monorepo`. No branch protection and no rulesets were created, so the release
  workflow's own bump push is unobstructed (bootstrap step 6 is the maintainer's
  decision).
- **Seed tag**: `v0.0.1` created by hand on `c4e916b` (the phase-1 HEAD at push
  time) and pushed **before** the branch, so the first workflow run already saw
  it. Verified on the remote with `git ls-remote --tags origin` →
  `c4e916b… refs/tags/v0.0.1`, and it is the only tag on the remote.
- **Pushed subject**: `chore: document granular npm token flow in
  MAINTAINERS.md`. All six commits reaching `main` are `chore:` or `mise:`, so
  the changelog step reported a skip as designed.
- **Rehearsal run**: `Package publishing` run
  [31298024182](https://github.com/ericvera/firebase-kit/actions/runs/31298024182)
  — **green in 26s**. Checkout, Node 24, `yarn install --immutable`, `yarn
  build`, `yarn lint`, Setup Firebase Tools, `yarn test`, and the `.mise/` guard
  all passed; the changelog step logged `Generated changelog is empty and
  skip-on-empty has been activated so we skip this step`; every one of the eight
  steps gated on `skipped == 'false'` (1.0.0 guard, both version steps, the bump
  commit, all three publishes, the release) shows as skipped.
- The changelog log line `## [0.0.2](…/compare/v0.0.1...v0.0.2)` is direct
  evidence the seed tag is being read as the previous version — the 1.2 review
  fix's whole premise. Nothing was published, no tag was created by the run, and
  no GitHub release exists.
- **Emulator setup works.** `Setup Firebase Tools` passed: `yarn info
  firebase-tools --name-only --json` emitted the single line
  `"firebase-tools@npm:15.23.0"` and the cache key resolved to
  `firebase-emulators-Linux-"firebase-tools@npm:15.23.0"` (cache miss, as
  expected on a first run). The 1.2 known-issue note is now closed out.
- **Registry state**: `firebase-kit-protocol`, `firebase-kit-client`, and
  `firebase-kit-admin` all return HTTP 404 from
  `https://registry.npmjs.org/<name>`. Nothing was published. No `yarn npm
  publish` was run anywhere.
- Feature branch rebased onto the new `main` (30 commits replayed, no
  conflicts). `main` is an ancestor of the branch, the branch tracks 19 `.mise/`
  files, and `main` tracks zero.
- Work stopped here. Task 2.1 must not start until the maintainer confirms all
  three placeholders are published and all three trusted publishers are
  configured.

### Deviations from plan

- **`main` is no longer at the commit that was pushed.** Creating the repository
  activated `.github/dependabot.yml` immediately: dependabot opened three PRs
  within two minutes, and PR #1 (`firebase-tools` 15.23.0 → 15.26.0, a
  non-major in the `dev-non-major` group) passed the auto-merge workflow's gates
  and merged, moving `main` to `d42fa5a`. This is the configured behaviour, not
  a defect — but two consequences matter downstream:
  - **The root `firebase-tools` pin is now `15.26.0`, not `15.23.0`.** The 1.3
    entry above tells task 2.4 to reuse the exact string `15.23.0` when pinning
    `firebase-tools` in `firebase-kit-admin`. **Read the current root
    `package.json` instead** and match whatever it says at that time; dependabot
    will keep moving it.
  - The merge did **not** trigger `publish.yml`. Merges performed by the
    auto-merge workflow authenticate with `GITHUB_TOKEN`, and GitHub does not
    raise workflow-triggering events for pushes made with that token. Harmless
    here (the merge carries no release-worthy commit) and irrelevant to real
    releases, which are pushed by a human, but worth knowing before anyone
    debugs a "missing" run.
- **`MAINTAINERS.md` bootstrap step 5 overstates the auto-merge prerequisite.**
  It says that without "Allow auto-merge" the auto-merge step *fails*. The
  repository reports `allow_auto_merge: false` and the step still succeeded and
  the PR still merged, because with no required status checks GitHub merges
  immediately rather than queueing. The step's advice is still correct once
  `main` is protected; it was left unedited because this task changes no files
  and the maintainer should enable the setting regardless.
- Two dependabot PRs are open and are **majors**, correctly excluded from
  auto-merge by the all-ecosystem major rule:
  - **#2 `typescript` 6.0.3 → 7.0.2 — check is red**, and legitimately so:
    `yarn lint` aborts with `typescript-eslint does not support TS 7.0`
    (typescript-eslint issue #10940 tracks support for TS >= 7.1). The gate did
    its job. Do not merge; close it or add a dependabot ignore until
    typescript-eslint supports TS 7.
  - **#3 `@types/node` 24.13.3 → 26.1.2 — check is green.** Maintainer's call.

### Verification

- Every checklist item confirmed against the remote rather than locally:
  repository visibility via `gh repo view --json visibility` → `PUBLIC`; tag via
  `git ls-remote --tags origin`; releases via `gh release list` → empty;
  registry via three `curl -o /dev/null -w %{http_code}` calls → `404` each.
- Run outcome read from `gh run view --log`, not from the summary UI, so the
  skip reason and the per-step conclusions are quoted from the log itself.
- Post-rebase quality gate on the feature branch: `yarn install --immutable`,
  `yarn format`, `yarn lint`, `yarn build`, `yarn test:unit` all exit 0 against
  the dependabot-updated lockfile, with a clean working tree afterwards.
- End-to-end tests: none — the project's test exception for consumer-facing
  wiring applies. The substitute verification is the live green workflow run
  plus the registry, tag, and release checks above, exactly as the task file
  specifies.

## 2.1 — `firebase-kit-protocol` source landed; real root `build` and per-package test orchestration

- Key changes (on `feat/publish-firebase-kit-packages`):
  - `packages/firebase-kit-protocol/src/{index,constants,types}.ts` — copied
    byte-for-byte from `/Users/eric/Code/okven/packages/firebase-kit-protocol`
    (`diff -r` clean). Okven's working tree is untouched.
  - `packages/firebase-kit-protocol/tsconfig.json` — Okven's file with one
    change: `removeComments` `true` → `false`, carrying the template's comment
    `/* Keep comments. Otherwise intellisense does not work. */`.
  - `packages/firebase-kit-protocol/package.json` — real manifest. Added `type:
    module`, `exports: "./dist/index.js"` (string form), `sideEffects: false`,
    `engines.node >= 24`, `files: ["dist", "!/**/__test__", "!*.test.*"]`,
    `scripts` `build` (`tsc --build`) and `lint` (`eslint .`), and
    `devDependencies` `@tsconfig/strictest ^2.0.8` / `eslint ^10.8.0` /
    `typescript ^6.0.3`. **No `test` script of any kind.** The placeholder's
    `name` / `version 0.0.1` / `description` / `license` / `repository` /
    `publishConfig` were left exactly as published.
  - `tsconfig.json` — `references: [{ "path": "./packages/firebase-kit-protocol" }]`.
  - `package.json` — all four phase-1 stubs replaced. `build` is now `tsc
    --build`; `test:unit` / `test:emulator` are `yarn build && yarn workspaces
    foreach --all --exclude @firebase-kit/monorepo run <test-unit|test-emulator>`;
    `test` is `yarn test:unit && yarn test:emulator`. The `-- STUBS: … --` marker
    key is gone.
  - `eslint.config.mjs` — `'./tsconfig.json'` restored to `parserOptions.project`
    and the 1.1 omission comment removed. Confirmed `yarn lint` stays green and
    that `eslint .` reports all three `src/*.ts` files in its file list.
  - `yarn.lock` — only the protocol workspace's new devDependency descriptors
    (+4 lines). No resolution changed.

### Deviations from plan

- **Per-package test scripts are named `test-unit` and `test-emulator`, not
  Okven's `ci:test` / `ci:test-emulator`, and their names must stay colon-free.**
  Tasks 2.2 and 2.3 must use these names. Yarn 4's `run` command has a global
  script fallback for any script name containing a colon: `yarn run <name>` in a
  workspace that does not define `<name>` will execute *another* workspace's
  script when exactly one workspace defines it (`yarn-4.18.0.cjs`:
  `!this.topLevel && !this.binariesOnly && this.scriptName.includes(":")` →
  filter workspaces with the script → `if (m.length === 1) executeWorkspaceScript`).
  Two failures were observed and fixed because of it:
  - The first draft used root-matching names (`foreach … run test:unit`). Because
    only the root defines `test:unit`, every child workspace's `yarn run
    test:unit` resolved back to the root script — `yarn test:unit` recursed
    infinitely and had to be killed.
  - The second draft used Okven's `ci:test` / `ci:test-emulator`. With **two**
    definers `ci:test` behaved correctly (one run per definer), but with a
    **single** definer `ci:test-emulator` ran three times — once per workspace,
    every one of them executing `firebase-kit-admin`'s script (proved by having
    the script print `process.cwd()`). Under Okven's names, task 2.3's emulator
    suite would have run three times per invocation.
  With colon-free names the fallback does not apply: `foreach run` executes the
  script only in workspaces that declare it. A `-- TESTS: … --` marker key in the
  root scripts block records the constraint.
- Package `devDependencies` were carried over from Okven (the task file does not
  list them), but pinned to the **root's** ranges rather than Okven's, per the
  maintainer's dependency policy — `typescript ^6.0.3` (6.x; typescript-eslint
  does not support TS 7) and `eslint ^10.8.0` (root's range, not Okven's
  `^10.7.0`). No `@types/node` is needed here. Task 2.4 still owns the audit.

### Verification

- `yarn install --immutable`, `yarn format`, `yarn lint`, `yarn build`,
  `yarn test`, `yarn test:unit`, `yarn test:emulator` all exit 0 from a deleted
  `dist/` and `.tsbuildinfo`; the working tree is clean after `yarn format`.
- **The restored `build` really compiles, verified by making it fail.** A
  temporary `src/probe.ts` with `export const probe: number = 'not a number'`
  made `yarn build` exit 1 with `error TS2322`; removing it restored a green
  build. `yarn build` emits `dist/{index,constants,types}.{js,d.ts}` — six files.
- **`removeComments: false` verified by reading the emitted declarations**, not
  by reading the config: `dist/types.d.ts` and `dist/constants.d.ts` retain every
  JSDoc block, including the enum member comment `/** Operation completed
  successfully */`.
- **The per-package orchestration was proved empirically, not by reasoning.**
  Temporary `test-unit` / `test-emulator` scripts printing `process.cwd()` were
  added to the two placeholder packages and then reverted:
  - `yarn test:unit` → exactly two invocations (client, admin); protocol skipped.
  - `yarn test:emulator` → exactly one invocation (admin); client and protocol
    skipped.
  - `yarn test` → both sequences, in order.
  With no package declaring either script (the real current state) both commands
  exit 0. This is the shape the task requires: protocol is excluded because it
  declares no test script, not by a tolerance flag.
- **No repository-wide "pass with no tests" setting exists.** `grep -rn
  passWithNoTests` over the repo (excluding `node_modules` / `.yarn`) returns
  nothing; phase 1 never introduced one and none was added.
- Both test commands build first (`yarn build &&` prefix), so the `dist/`
  resolution that tasks 2.2/2.3 depend on exists on a clean checkout.
- `git status` in `/Users/eric/Code/okven` is clean — the source repository was
  read only.
- `yarn workspace firebase-kit-protocol pack --dry-run` lists exactly
  `README.md`, `package.json`, and the six `dist/` files.
- End-to-end tests: none — the project's test exception for library packages with
  no e2e infrastructure applies. Substitute verification, from a scratch
  directory outside the repo:
  - **Runtime**: `node` ESM import of the built `dist/index.js` printed
    `SuccessResult.Success = success`, all six `CallableErrorCode` keys, and
    `client/rate-limit-exceeded`.
  - **Types by package name**: a scratch project with
    `node_modules/firebase-kit-protocol` symlinked to the package and
    `moduleResolution: NodeNext` type-checked clean against `CallableMap`,
    `WithAPIVersion`, `SuccessResponseData`, `IsEverythingOKResponseData`,
    `CallableErrorCode`, and `SuccessResult`. `--traceResolution` confirms
    `'firebase-kit-protocol'` resolves through `exports` to
    `dist/index.d.ts@0.0.1`.

## 2.2 — `firebase-kit-client` source landed, wired to protocol, clean under the stricter lint

- Key changes (on `feat/publish-firebase-kit-packages`):
  - `packages/firebase-kit-client/src/` — all 80 files copied from
    `/Users/eric/Code/okven/packages/firebase-kit-client`. 58 are byte-identical;
    22 differ, every difference driven by a lint finding (list below). Okven's
    working tree is untouched (`git status` clean there).
  - `packages/firebase-kit-client/tsconfig.json` — Okven's file with
    `removeComments` `true` → `false` (same comment as 2.1); keeps
    `references: [{ "path": "../firebase-kit-protocol" }]`.
  - `packages/firebase-kit-client/vitest.config.ts` — `root` still
    `join(import.meta.dirname, 'src')` with its explanatory comment,
    `mockReset: true`, the node_modules/dist excludes and
    `setupFiles: ['./__test__/setup/vi.setup.ts']` all preserved. The single
    project is now **named `unit`**, matching the name `firebase-kit-admin`
    (task 2.3) will use for its unit group, so both packages are selected the
    same way.
  - `packages/firebase-kit-client/package.json` — real manifest replacing the
    placeholder. `type: module`, all 7 `exports` entries, `files` (including
    `!/**/__mocks__`), `sideEffects: false`, `engines.node >= 24`,
    `publishConfig.access public`, `version 0.0.1` (**not** Okven's `0.0.0`),
    `dependencies: { "firebase-kit-protocol": "workspace:*" }` (**not**
    `workspace:^`), Okven's peer / optional-peer (`vitest`) / dev dependencies
    carried over with `eslint` and `typescript` pinned to the root's ranges.
    Scripts: `build`, `lint`, `test-unit` (`tsc --build && vitest run
    --project=unit`) and `test` (`yarn test-unit`). No `test-emulator` script —
    that is what keeps the package out of `yarn test:emulator`.
  - `tsconfig.json` — second project reference, `./packages/firebase-kit-client`.
  - `package.json` — root `lint` is now `yarn build && eslint .` (see
    deviations).
  - `yarn.lock` — the client workspace's dependency graph (firebase, getsetdel,
    fake-indexeddb and their transitives).

### Lint fallout — measured before fixing

`yarn lint` on the freshly copied source: **51 errors, 0 warnings, across 21 of
the 80 files.** By rule:

| count | rule |
| ----- | ---- |
| 14 | `@typescript-eslint/restrict-template-expressions` |
| 9 | `@typescript-eslint/no-empty-function` |
| 9 | `@typescript-eslint/no-unnecessary-type-arguments` |
| 4 | `@typescript-eslint/no-confusing-void-expression` |
| 3 | `@typescript-eslint/prefer-promise-reject-errors` |
| 2 | `@typescript-eslint/no-unnecessary-type-parameters` |
| 2 | `@typescript-eslint/require-await` |
| 1 each | `consistent-type-definitions`, `use-unknown-in-catch-callback-variable`, `no-unsafe-assignment`, `no-unsafe-argument`, `return-await`, `prefer-nullish-coalescing`, `no-unnecessary-condition`, `no-misused-promises` |

Fixing the first pass surfaced 8 more `no-unnecessary-type-arguments` (the
Firestore `Query` / `DocumentReference` *first* type argument is also a default,
so `Query<DocumentData>` had to become `Query`) and then 5
`no-unused-vars` for the `DocumentData` imports that left behind — **64
findings resolved in total**. Every one was fixed by changing code: no rule was
disabled or downgraded, there is no `eslint-disable`/`@ts-expect-error` anywhere
in the package, and no type assertion was added (`as` occurrences went 123 → 126,
all three being the English word "as" in new comments; the assertion count is
unchanged).

Non-mechanical fixes worth recording:

- **`createActionableFunctionCaller`.** `TCommand` was used once, so
  `no-unnecessary-type-parameters` fired; inlining its constraint would have
  silently widened the public API (`A extends string & keyof TMap`). Instead
  `RequestResponseMap` gained an optional command parameter
  (`RequestResponseMap<TCommand extends string = string>`) and the caller now
  constrains `TMap extends RequestResponseMap<TCommand>` — the same shape the
  protocol's `CallableMap` already uses (`TMap extends Record<TCommand, …>`).
  `ActionableFunctionCallerOptions` gained `TCommand` as its first parameter so
  `rateLimitMap` is keyed by the group's commands rather than by `string`.
  This is also what let the test's `TestMap` become an `interface`
  (`consistent-type-definitions`) — an interface is not assignable to a
  `Record<string, …>` index signature, but is assignable to
  `Record<'get-entry' | 'update-order', …>`.
- **`JSON.parse` is typed `any`**, which produced the `no-unsafe-assignment` /
  `no-unsafe-argument` pair. Getting from `any` to a named type without an
  assertion is impossible under these rules, so the round trip is held at
  `unknown` (`const sanitizedData: unknown = …`, which the rule permits) and the
  callable's *request* type parameter is now `unknown`. Nothing is lost: the
  old `httpsCallable<WithAPIVersion<{ action: A } & TMap[A][0]>, …>` checked
  nothing, because the `any` was passed straight into it. `WithAPIVersion` still
  documents the stamped request, now as the annotation on `dataWithVersion`.
- **`return-await`** was fixed by moving the `return reviveTimestamps(...)`
  *out* of the `try`, not by adding `await` inside it. Adding the `await` would
  have started wrapping timestamp-revival failures in `toActionableError`, which
  is a behaviour change; the current shape preserves the original semantics.
- **`no-misused-promises`** in `subscribeWithCache`: the async `onUpdates`
  callback was extracted to a named `handleUpdates` and the callback now does
  `void handleUpdates(updates)`. Rejections stay unhandled exactly as before.
- **`prefer-nullish-coalescing`** in `ConnectivityError`: `message || default`
  became an explicit `message === undefined || message === ''` ternary rather
  than `??`, so a caller passing `''` still gets the default message.
- **`prefer-promise-reject-errors`** (×3) was fixed by tightening the *declared*
  types of the values being rejected (`unknown` → `Error | undefined`) rather
  than by wrapping at the reject site. Every call site already passed an `Error`.
- **`require-await`** in `createFirebaseFunctionsClientMock`: the `async`
  keyword was dropped and every failure path returns `Promise.reject(...)`, so
  the failures stay asynchronous instead of becoming synchronous throws.
- **`no-empty-function`** (×9): `() => {}` became `() => undefined`.

### Deviations from plan

- **Root `lint` is now `yarn build && eslint .`.** This package is the first one
  that imports another workspace, and typed linting resolves
  `firebase-kit-protocol` through its `exports` to `dist/index.d.ts`. With no
  `dist/` present, `yarn lint` fails with three `no-unsafe-*` errors on
  `CallableErrorCode`. Verified both ways: with `packages/firebase-kit-protocol/dist`
  deleted `yarn lint` exits 1; building only the protocol makes it exit 0. The
  `yarn build &&` prefix is the same device task 2.1 used on `test:unit` /
  `test:emulator`, for the same reason. CI already ran `yarn build` before
  `yarn lint`, so the extra build there is an incremental no-op.
- **The vitest project is named `unit`** rather than left unnamed, per the task's
  step 4 — the shape task 2.3 needs. `test-unit` therefore selects
  `--project=unit`, which will read identically in both packages.
- Package `devDependencies` follow the maintainer's dependency policy rather
  than Okven's exact strings: `eslint ^10.8.0` (root's range, not Okven's
  `^10.7.0`) and `typescript ^6.0.3` (6.x). `getsetdel ^2.0.0` is left exactly
  as-is in both peer and dev positions, as instructed. Task 2.4 still owns the
  audit.

### Verification

- `yarn install --immutable`, `yarn format`, `yarn lint`, `yarn build`,
  `yarn test`, `yarn test:unit`, `yarn test:emulator` all exit 0 **from a state
  with both packages' `dist/` and `.tsbuildinfo` deleted**; the working tree is
  clean after `yarn format`.
- **Counts reconcile exactly.** `yarn test:unit` reports **29 test files / 149
  passing cases**, and `yarn workspaces foreach --verbose` shows the runner
  invoked for exactly one workspace (`firebase-kit-client`); protocol is skipped
  because it declares no `test-unit`. Independently: 29 `*.test.ts` files and
  149 `it(` occurrences in `src/`, matching the Okven source. `grep` for
  `it.skip` / `it.only` / `.todo` / `describe` across the test files returns 0 —
  no test was deleted, skipped, or weakened.
- **The `__mocks__` shims were proved active, not merely present**, three ways:
  - Pointing `root` at the package directory instead of `src` (and fixing the
    `setupFiles` path so the run still starts): **2 files failed, 22 of 149 cases
    failed**, with `TypeError: cachedEntries is not iterable` and snapshot
    mismatches — the suite running against the *real* `getsetdel`. Restored, back
    to 29/149.
  - Removing `src/__mocks__/getsetdel/`: 2 files fail, 127 of 149 cases run.
  - Removing `src/__mocks__/firebase/`: `getHostingFirestore.test.ts` fails to
    load, 145 of 149 cases run.
- `yarn test:emulator` runs nothing for this package (no `test-emulator` script),
  and exits 0 — exclusion is structural, not a tolerance flag.
- `yarn workspace firebase-kit-client pack --dry-run` lists 97 entries: `README.md`,
  `package.json` and `dist/` only. No `__mocks__`, no `__test__`, no `*.test.*`.
  All 7 `exports` targets exist in `dist/`.
- `removeComments: false` confirmed by reading emitted declarations — the JSDoc
  blocks survive into `dist/**/*.d.ts`.
- The dynamic `import('firebase/functions')` is still dynamic: the new
  `import type { HttpsCallableResult }` is erased, and
  `dist/callable/createActionableFunctionCaller.js` has no static
  `firebase/functions` import.
- `git -C /Users/eric/Code/okven status --short` is empty — the source repository
  was read only.
- End-to-end tests: none — the project's test exception for library packages with
  no e2e infrastructure applies. The substitute verification is the 29-file /
  149-case reconciliation and the three automock activation experiments above.

## 2.2 (review fix) — Public surface restored to Okven's, pre-commit hook fixed for a fresh clone

Three lint-driven changes from 2.2 had altered the published type surface, which
the approved requirements put out of scope, plus one pre-commit gap raised in the
same review.

- Key changes (on `feat/publish-firebase-kit-packages`):
  - `src/callable/types.ts` — `ActionableFunctionCallerOptions` takes
    `TRateLimitCategory` **first** again, with `TCommand extends string = string`
    added as an optional **second** parameter. `TCommand` now has two uses in the
    interface, which is what `no-unnecessary-type-parameters` wanted, while
    `ActionableFunctionCallerOptions<MyCategory>` keeps compiling and, at the
    default `TCommand = string`, `rateLimitMap` emits exactly Okven's
    `Partial<Record<string, TRateLimitCategory>>`. `RequestResponseMap` is back to
    Okven's unparameterised `Record<string, [object | undefined, unknown]>` with
    its original doc comment, its type parameter having become unused.
  - `src/callable/createActionableFunctionCaller.ts` — `TMap extends
    RequestResponseMap` restored (it had been narrowed to
    `RequestResponseMap<TCommand>`, which rejected a map that does not cover
    every member of the command union); the options argument is now
    `ActionableFunctionCallerOptions<TRateLimitCategory, TCommand>`.
  - `src/callable/createActionableFunctionCaller.test.ts` — the type-argument
    edit 2.2 was forced into is reverted: `createCall` again takes
    `ActionableFunctionCallerOptions<TestCategory>`. `TestMap` stays an
    `interface` (`consistent-type-definitions`) but now extends
    `RequestResponseMap`, which is how an interface satisfies the restored
    `Record<string, …>` constraint. No case, assertion or snapshot changed.
  - `src/testing/createGetSetDelMock.ts` — `failEntriesWith` takes `unknown`
    again, matching Okven, and the armed fault is stored at `unknown`. The
    rejection site normalises: an `Error` is rejected as-is, anything else is
    carried as the `cause` of one, which is what `prefer-promise-reject-errors`
    requires. No suppression and no type assertion.
  - `package.json` — new root script `lint-changed` (`yarn build && eslint
    --cache`), and `lint-staged` runs it instead of bare `eslint --cache`. Typed
    linting resolves `firebase-kit-protocol` through package `exports` into
    `dist/`, so on a fresh clone the pre-commit hook used to fail on
    `RateLimitError.ts` before anything had been built.

### Deviations from plan

- `failEntriesWith` cannot be made byte-identical to Okven in behaviour as well
  as in signature: rejecting a raw `unknown` is exactly what
  `prefer-promise-reject-errors` forbids, and the rule cannot be satisfied
  without either a suppression, an assertion, or normalising the value. The
  signature and every in-repo call (all of which pass an `Error`) are unaffected;
  only a caller arming the fault with a non-`Error` would now see that value as
  `error.cause` rather than as the rejection reason itself.
- One optional type parameter (`TCommand`) remains added to
  `ActionableFunctionCallerOptions`. It is additive and defaulted, so every
  existing instantiation is unchanged.

### Verification

- **Whole emitted `.d.ts` surface diffed against the Okven original.** Both trees
  built from the same tsconfig, same TypeScript and same `node_modules`, 80
  declaration files each. `diff -r` reports **two files, three hunks**, all of
  them the additive optional parameter above:
  `ActionableFunctionCallerOptions<TRateLimitCategory extends string, TCommand
  extends string = string>`, its `rateLimitMap` written in terms of `TCommand`,
  and the `options?` type argument on `createActionableFunctionCaller`. The other
  78 files, including `RequestResponseMap` and `failEntriesWith`, are identical.
- **Consumer compile against the built package**, importing
  `firebase-kit-client/callable` and `firebase-kit-client/testing` through their
  published entry points: `ActionableFunctionCallerOptions<Category>` with one
  type argument, a `TMap` covering `'a' | 'b'` against `TCommand = 'a' | 'b' |
  'c'`, and `failEntriesWith('not an error')` all type-check; the harness was
  proved sensitive by a deliberate error.
- `yarn format`, `yarn lint` (exit 0, no rule disabled, no `eslint-disable`, no
  new assertion), `yarn build`, `yarn test` all pass; the suite is still
  **29 test files / 149 passing cases**, with no case skipped or weakened.
- **Fresh-clone pre-commit reproduced and fixed.** With every `dist/` and
  `.tsbuildinfo` deleted, bare `eslint --cache` fails with the three
  `no-unsafe-*` errors on `rate-limit/RateLimitError.ts(.test.ts)`;
  `yarn lint-changed` on the same files exits 0. This commit was made with
  `dist/` deleted, so the hook itself ran the build path.
- `/Users/eric/Code/okven` unmodified (`git status` clean there).

## 2.3 — `firebase-kit-admin` source landed, emulator suite wired into the root commands

- Key changes (on `feat/publish-firebase-kit-packages`):
  - `packages/firebase-kit-admin/src/` — all 147 files copied from
    `/Users/eric/Code/okven/packages/firebase-kit-admin`. **120 are
    byte-identical; 27 differ**, 26 of them driven by a lint finding and one
    (`__test__/setup/vi.setup.ts`) a comment fixing a cross-reference to a script
    name that no longer exists (`ci:test-emulator` → `test-emulator`). Okven's
    working tree is untouched (`git status` clean there).
  - `packages/firebase-kit-admin/firebase.json` and `firestore.rules` — copied,
    byte-identical to Okven (`diff` clean).
  - `packages/firebase-kit-admin/vitest.config.ts` — byte-identical to Okven.
    Both named projects (`unit`, `emulator`), the filename-based split,
    `root` at `src` in **both**, `mockReset: true` repeated in each, and the two
    explanatory comments all preserved.
  - `packages/firebase-kit-admin/tsconfig.json` — Okven's file with
    `removeComments` `true` → `false` (same comment as 2.1/2.2); keeps
    `references: [{ "path": "../firebase-kit-protocol" }]`.
  - `packages/firebase-kit-admin/package.json` — real manifest replacing the
    placeholder. `type: module`, all **10** `exports` entries (`./mocks`
    included), `files` (`dist` plus the three exclusions), `sideEffects: false`,
    `engines.node >= 24`, `publishConfig.access public`, `version 0.0.1`
    (**not** Okven's `0.0.0`), `dependencies: { "firebase-kit-protocol":
    "workspace:*" }` (**not** `workspace:^`). Okven's peer / optional-peer
    (`betterbe`, `firestore-snapshot-utils`, `vitest`) / dev dependencies carried
    over with `eslint` pinned to the root's `^10.8.0` and `firebase-tools` to the
    root's current `15.26.0` (1.4 recorded that dependabot moved it off
    `15.23.0`). Scripts: `build`, `lint`, `test-unit`
    (`tsc --build && vitest run --project=unit`), `test-emulator`, and
    `test` (`yarn test-unit && yarn test-emulator`).
  - `tsconfig.json` — third project reference, `./packages/firebase-kit-admin`.
  - `yarn.lock` — the admin workspace's dependency graph.
  - Root `package.json` is **unchanged**: `test:unit` / `test:emulator` already
    `foreach` over every workspace, so declaring the two colon-free scripts in
    the package is what enrolls it. Verified with `--verbose`: `test-emulator`
    runs for exactly one workspace, `test-unit` for two.

### The emulator command

`test-emulator` is
`tsc --build && firebase emulators:exec --project demo-admin-tests --only auth,firestore "TZ=Etc/Universal vitest run --project=emulator"`
— every element the task file lists is preserved, including the **absence** of
`--config`. That is safe because `yarn workspaces foreach … run` executes a
package script with the package directory as cwd, which is where `firebase.json`
sits; this was confirmed by running the suite through the root command, not by
reading the script. The three duplicated-config sites agree: `firebase.json`
(auth `9298`, firestore `8281`, hub `4481`, logging `4581`, host `127.0.0.1`),
the script's `--project demo-admin-tests`, and `src/__test__/setup/vi.setup.ts`
(`projectIdBase: 'demo-admin-tests'`, `firestoreHost: '127.0.0.1:8281'`,
`authHost: '127.0.0.1:9298'`).

### Lint fallout — measured before fixing

`eslint packages/firebase-kit-admin` on the freshly copied source: **178 errors,
0 warnings, across 28 of the 148 linted files.** By rule:

| count | rule |
| ----- | ---- |
| 51 | `@typescript-eslint/no-unsafe-call` |
| 51 | `@typescript-eslint/no-unsafe-member-access` |
| 19 | `@typescript-eslint/no-unsafe-assignment` |
| 17 | `@typescript-eslint/require-await` |
| 16 | `@typescript-eslint/restrict-template-expressions` |
| 6 | `@typescript-eslint/consistent-type-definitions` |
| 4 | `@typescript-eslint/unbound-method` |
| 4 | `@typescript-eslint/no-unnecessary-type-parameters` |
| 3 | `@typescript-eslint/no-unnecessary-condition` |
| 2 | `@typescript-eslint/array-type` |
| 1 each | `no-confusing-void-expression`, `no-unused-vars`, `only-throw-error`, `no-unsafe-argument`, `no-empty-function` |

All 178 fixed by changing code. No rule disabled or downgraded, no
`eslint-disable` anywhere in the package, and **no type assertion added** —
`as`-token counts went 97 → 102 and a term-by-term diff shows all five additions
are the English word "as" inside new comments. The single `@ts-expect-error` in
`assertNever.test.ts` is Okven's, unchanged.

Non-mechanical fixes worth recording:

- **121 of the 178 findings (`no-unsafe-call` / `-member-access` /
  `-assignment`) come from one root cause**: `vi.fn()` with no type argument is
  `Mock<(...args: any[]) => any>`, so every chained call in
  `createFirebaseAdmin{Storage,Functions,Firestore}Mock.test.ts` traverses `any`.
  The `any` originates in the *published* factories, and no annotation at the
  test site can launder it (assigning `any` to a typed local is itself
  `no-unsafe-assignment`). The three factories are now typed: each spy is
  `vi.fn<PlainFunctionType>()` and the object shapes they hand back are named
  interfaces. Care was taken not to write `vi.fn<SomeInterface['method']>()`
  where the member is already a `Mock`, which emits `Mock<Mock<…>>`; the first
  pass did that and was corrected after reading the emitted declarations.
- **`checkClaimsVersion`** (`no-unnecessary-condition` ×2): `claims?.v` looks
  unnecessary because `user.customClaims` is asserted to `TClaims`, but
  `customClaims` is genuinely `undefined` for a user whose claims were never
  written — and `assertNever.test.ts`'s sibling case
  `'rejects when the user has no stored claims at all'` exercises exactly that.
  Dropping the chain would have turned that test's expected mismatch into a
  `TypeError`. The stored version is now read off `user.customClaims?.['v']`,
  where the optional chain is necessary by type. `auth.token?.` was dropped, as
  `AuthData['token']` is non-optional.
- **`validateSchema`** (`require-await`): the `async` keyword was removed and
  both exits rebuilt as `Promise.reject(...)` / `Promise.resolve(...)`, so a
  validation failure stays a *rejection* rather than becoming a synchronous
  throw. The emitted signature is unchanged — this file is not in the `.d.ts`
  diff.
- **`createFirebaseAdminFunctionsMock`** (`require-await`, `only-throw-error`):
  same treatment; every `throw` inside the enqueue implementation became a
  `Promise.reject`, because a synchronous throw would have broken the three
  `await expect(...).rejects` cases. `throw enqueueFailure` (an `unknown`) is
  normalised the way task 2.2's `failEntriesWith` was: an `Error` is rejected
  as-is, anything else is carried as the `cause` of one.
- **`assertNever`** (`no-unused-vars` on `_`, plus
  `no-confusing-void-expression` in its test): the parameter is renamed and
  discarded with `void value`. The test's
  `expect(assertNever(...)).toBeUndefined()` cannot be written at all under the
  rule — a `void`/`undefined`-typed call may not be consumed by any expression,
  including a variable initialiser — so it now calls through `vi.fn(assertNever)`
  and asserts `toHaveReturnedWith(undefined)`, which checks the same fact
  without changing the production signature.
- **`assertNever.test.ts`'s if-else case** (`no-unnecessary-condition`): an
  exhaustive if-else ending in `assertNever` structurally *requires* a final
  always-true literal comparison — that redundancy is what leaves the `else` a
  `never`. Comparing against a `Status`-typed constant silences the rule but
  also stops the narrowing, so `assertNever(status)` then fails to compile
  (tried, reverted). The branch now tests a `value is 'completed'` type guard:
  inside the guard the comparison is against the full union, and at the call
  site the negative predicate still narrows the `else` to `never`.
- **The three `*DataPoint` builders** (`no-unnecessary-type-parameters` ×4):
  inlining `TCollection` to its `string` constraint would delete the
  compile-time collection-name check that `createFirestoreUtils`'s doc comment
  calls "the point". Each builder instead declares a named call-signature
  interface (`CollectionDataPoint<TCollection>` etc.) as its return type; using
  the parameter as a *type argument* is what the rule accepts, and the emitted
  type is structurally identical to the inline one it replaces.
- `restrict-template-expressions` (16) fixed with `String(...)`, except in
  `createFirebaseAdminAppMock` where hoisting `options?.projectId` into a
  `const` restored the narrowing the closure had lost.
- `unbound-method` (4): `expect(writer.set).toBeTypeOf('function')` →
  `expect(typeof writer.set).toBe('function')`.
- `require-await` in six test files: `async` callbacks with no `await` became
  plain callbacks. Where the callee's signature demands a promise
  (`Firestore.runTransaction`, `createRunTransaction`) the body now ends in
  `return Promise.resolve(...)`; `createRunBatch` already accepted
  `T | Promise<T>`.
- **`src/__test__/utils/setFakeTimer.ts` was left alone**, as instructed. It
  still hard-codes `TestTimeZone = 'America/Puerto_Rico'` with a comment about
  a shared constant this package cannot reach — a fossil of the product this
  code is leaving. Tests assert against it, so changing it is behaviour change.

### Public surface: the whole emitted `.d.ts` diffed against Okven

Okven's pristine `src/` was built in a scratch tree with the same TypeScript,
the same `node_modules` and `removeComments: false`, giving **147 declaration
files on each side** (count checked before trusting the diff — declaration emit
being off would have made a clean diff meaningless). **15 files differ**, every
difference accounted for:

- **Structurally identical, textual only (6 files)** —
  `TransactionReader.d.ts` (`Array<T>` → `T[]`); `createFirestoreUtils.d.ts`,
  `__test__/db/testDB.d.ts` and the three `*DataPoint.d.ts` (inline call
  signature → the named interface described above, plus the interface
  declaration itself); `internal/assertNever.d.ts` (parameter renamed `_` →
  `value`, which is not part of type identity, and the module is under
  `src/internal/`, exported by no entry point).
- **`type` → `interface` (4 files)** — `InitOptions`, `FirestoreUtilsOptions`
  (both public), `CheckDocumentInQueryExistsOptions` (non-exported) and the
  three `__test__/db/types.ts` fixtures. Forced by `consistent-type-definitions`,
  which has no third option. The one observable consequence is that an interface
  has no implicit index signature, so `InitOptions`/`FirestoreUtilsOptions` are
  no longer assignable to `Record<string, unknown>`; both are option bags a
  consumer builds as an object literal, and every in-repo use still compiles.
- **Mock spies typed (3 files, plus the `__mocks__` re-export)** — the
  `Mock<Procedure>` (`any`) entries on `createFirebaseAdmin{Storage,Functions,
  Firestore}Mock`'s return values now carry real signatures, and
  `createFirebaseAdminFunctionsMock` exports two new names (`TaskOptions`,
  `MockTaskQueue`, `EnqueueTask`) because declaration emit needs them nameable
  from the `__mocks__` barrel. This is a genuine narrowing of `./mocks`'s
  published types and is the one change here that could affect a consumer — but
  the `any` is exactly what `no-unsafe-*` forbids consuming, and it cannot be
  removed at the call site. Nothing was published from this package before
  `0.0.1`, which carries no code.

Every other declaration file — including all of `auth/`, `callable/`,
`errors/`, `runtime/`, `tasks/`, `testing/`, `validation/` and both
`validateSchema` variants — is byte-identical to Okven's.

### Deviations from plan

- Root `package.json` needed no edit (see above); enrolment is by declaring the
  two package scripts, which is the structure task 2.1 built.
- `src/__test__/setup/vi.setup.ts` is the one non-lint source change: its
  comment named `ci:test-emulator`, a script that does not exist in this repo.
- The task file's step 7 asks to confirm the CI emulator job passes. **It could
  not be exercised in this task** — see Verification.

### Verification

- `yarn install --immutable`, `yarn format`, `yarn lint`, `yarn build`,
  `yarn test`, `yarn test:unit`, `yarn test:emulator` all exit 0, with `yarn
  build` run from every `dist/` and `.tsbuildinfo` deleted. Working tree clean
  after `yarn format`.
- **Counts reconcile exactly.** `yarn test:unit` → **48 test files / 180 passing
  cases** for `firebase-kit-admin` (client unchanged at 29/149). `yarn
  test:emulator` → **7 test files / 21 passing cases**. Independently, the Okven
  source holds 55 `*.test.ts` (48 non-emulator + 7 emulator) and, counted with a
  word-boundary regex, 180 and 21 `it(` calls. `grep` for
  `it.skip` / `it.only` / `.todo` returns nothing — no test deleted, skipped or
  weakened.
- **The `__mocks__` shims were proved active, not merely present**, two ways:
  - Repointing `root` from `src` to the package directory (and fixing
    `setupFiles` so the run still starts): **13 files failed, 29 of 179 cases
    failed**, the suite running against the real `firebase-admin/*`. Restored,
    back to 48/180.
  - Removing `src/__mocks__/firebase-admin/app/`: 11 files fail to load,
    156 cases run. Restored, back to 48/180.
- **The two groups are independent.** `yarn test:unit` starts no emulator (runs
  in ~1.7s with no `emulators:exec` output) and runs 48 files; the emulator
  project runs 7. `yarn workspaces foreach --verbose run test-emulator` shows
  **one** invocation, `firebase-kit-admin`; `run test-unit` shows two.
- **Emulator tests need no real project or credentials.** The CLI logs
  `Detected demo project ID "demo-admin-tests", emulated services will use a
  demo configuration and attempts to access non-emulated services for this
  project will fail.` No credential is configured anywhere.
- `yarn workspace firebase-kit-admin pack --dry-run` lists `README.md`,
  `package.json` and `dist/` only — no `__mocks__`, no `__test__`, no
  `*.test.*`, and neither `firebase.json` nor `firestore.rules`. All 10
  `exports` targets exist in `dist/`, `./mocks` included.
- **`yarn info firebase-tools --name-only --json` still returns exactly one
  line** (`"firebase-tools@npm:15.26.0"`). This matters: the composite action
  appends it straight to `$GITHUB_OUTPUT`, so the admin package's pin must stay
  byte-identical to the root's or the emulator cache key breaks.
- `git -C /Users/eric/Code/okven status --short` is empty.
- **The CI emulator job was NOT observed passing.** `publish.yml` triggers only
  on push to `main` and `dependabot.yml` only on dependabot pull requests, so no
  workflow runs on this feature branch, and this task is under an explicit
  no-push instruction. What was verified instead: the composite action is
  referenced before `yarn test` in both workflows, its `yarn info` contract still
  holds with a second declarer of `firebase-tools` present, and the suite itself
  passes locally against Java 21 (temurin, the same distribution the action
  installs) with the emulator downloading its jar on demand. **The first real
  execution of the CI emulator path is the merge to `main`.**
- End-to-end tests: none — the project's test exception for library packages
  with no e2e infrastructure applies. The substitute verification is the
  emulator suite (7 files / 21 cases) passing locally, the 48/180 unit
  reconciliation, the two automock activation experiments, and the whole-`.d.ts`
  diff above.

## 2.3 (review fix) — `./mocks` published types restored to Okven's, mock rejection behaviour restored, weakened test restored

Four defects found in `162fc21`. All four fixed; source edits stay inside the
seven files below and nothing outside `packages/firebase-kit-admin/src/`
changed.

- **Defect 1 — a weakened test.** `firestore/internal/createRunBatch.test.ts`
  had `require-await` fixed by deleting `async` and leaving `return 'written'`,
  which made the case shape-identical to the sibling
  `'commits after a synchronous callback with no return value'` while its name
  still claimed it awaited a promise. Now `return Promise.resolve('written')`,
  the same device already used in `createRunTransaction.test.ts` and the two
  emulator files. `createRunBatch` still awaits a promise-returning callback and
  still returns its value; the inline snapshot is unchanged.

- **Defect 2 — `./mocks` published types were narrowed with no finding forcing
  it.** The 121 `no-unsafe-*` findings the retype was justified by are almost
  entirely in the three `*Mock.test.ts` files, which the package excludes from
  publication. Per-file, the published factories carried **0** findings
  (firestore) and **8 `require-await`** (storage).
  - `mocks/createFirebaseAdminFirestoreMock.ts` is now **byte-identical to
    Okven** — 7 type aliases and 4 interfaces removed, all 6 `vi.fn()` untyped
    again.
  - `mocks/createFirebaseAdminStorageMock.ts` is Okven's file plus **only** the
    8 `require-await` fixes (`async` implementation → explicit
    `Promise.resolve(...)`); 10 type aliases and 2 interfaces removed, all 11
    `vi.fn()` untyped again.
  - The test-file findings are resolved **in the test files**, which are not
    published. Each declares the faked surface locally and binds the entry point
    through it — `const firestore: MockFirestore = mock.getFirestore()`,
    `const getStorage: () => MockStorage = mock.getStorage` (the storage helper
    returns `{ ...mock, getStorage }`, so every case body is untouched), and
    `const queue: MockTaskQueue = mock.getFunctions().taskQueue('general')`.
    This works because the sender is the typed `Mock<…>`/`storage` object rather
    than an `any`, which is what `no-unsafe-assignment` reports on; annotating an
    `any` directly would still have been a finding. No assertion, no suppression.
  - `mocks/createFirebaseAdminFunctionsMock.ts` keeps a type, narrowed to what
    its own findings require: **only** `taskQueueMock`, whose parameter is read
    back as `taskQueueMock.mock.lastCall?.[0]`. It is now
    `vi.fn<(queueName: string) => { enqueue: Mock }>()`. `enqueueMock` is
    `vi.fn()` again, so its published type matches Okven's exactly.

- **Defect 3 — silent runtime behaviour change, resolved without a
  suppression.** `setEnqueueFailure(failure: unknown)` had started rejecting a
  non-`Error` failure as `new Error('Enqueue failed', { cause: failure })`. The
  raw value is restored. The escape the review asked about exists:
  `prefer-promise-reject-errors` sets `allowThrowingUnknown: false`, so
  `Promise.reject(value)` and `new Promise((_, reject) => reject(value))` are
  both flagged — but `only-throw-error` sets `allowThrowingUnknown: **true**`,
  and the reason the original `throw enqueueFailure` was flagged at all is that
  `if (enqueueFailure !== undefined)` narrows `unknown` to `{}`. Passing the
  value through a module-scope helper whose parameter is declared `unknown`
  restores the wide type:

  ```ts
  const rejectWithFailure = (failure: unknown): Promise<never> =>
    Promise.resolve().then(() => {
      throw failure
    })
  ```

  No `eslint-disable`, no assertion, no rule change. **Nothing to raise under
  step 9.**

- **Defect 4 — unrequested new exports on `./mocks`.** `TaskOptions` is a
  non-exported `interface` again, and `EnqueueTask` / `MockTaskQueue` are gone
  entirely. Confirmed from a consumer: importing any of the three from
  `firebase-kit-admin/mocks` is `TS2305`, while Okven's own `TaskRecord` still
  resolves.

### Deviations from plan

- **The review's suggested fix for defect 4 — "make these local again" — does
  not compile.** `src/__mocks__/firebase-admin/functions/index.ts` destructures
  the factory's result into new exported `const`s, so declaration emit for
  *that* file has to name the types; with them local, `tsc --build` fails with
  three `TS4023 … but cannot be named` (verified). The sibling storage/firestore
  factories are unaffected only because no `__mocks__` barrel re-exports them.
  Removing the two names outright and inlining the one shape still needed
  (`{ enqueue: Mock }`, `Mock` being nameable from `vitest`) satisfies both the
  no-new-exports requirement and declaration emit, and narrows less than the
  local-type version would have.
- `firestore/internal/create{,Sub,NestedSub}CollectionDataPoint.ts` still export
  the three named call-signature interfaces `no-unnecessary-type-parameters`
  forced in 2.3. They are **additive**, and `src/firestore/index.ts` does not
  re-export those modules, so they are reachable from no entry point — the same
  status as `src/internal/`. Left as-is; flagged here because they are the only
  remaining new exported names in the package.

### Verification

- **Whole emitted `.d.ts` surface diffed against pristine Okven again.** Okven's
  untouched `src/` built in a scratch tree with this repo's `tsconfig.json`,
  `node_modules` and TypeScript. **147 declaration files on each side, file
  lists identical** (checked before trusting the diff). **12 files differ**, down
  from 15:
  - **Gone from the diff** — `mocks/createFirebaseAdminStorageMock.d.ts` and
    `mocks/createFirebaseAdminFirestoreMock.d.ts` are now byte-identical to
    Okven's.
  - **Still differing, unpublished (3)** — `__mocks__/firebase-admin/functions/
    index.d.ts` and `__test__/db/{testDB,types}.d.ts`. Both directories are
    excluded by `files`.
  - **Still differing, published, previously assessed and accepted (8)** — the
    four `type`→`interface` conversions (`types.d.ts` `InitOptions`,
    `firestore/types.d.ts` `FirestoreUtilsOptions`,
    `firestore/checkDocumentInQueryExists.d.ts`, plus the `__test__` fixtures),
    `firestore/internal/TransactionReader.d.ts` (`Array<T>` → `T[]`),
    `internal/assertNever.d.ts` (parameter rename), and
    `firestore/createFirestoreUtils.d.ts` + the three `*DataPoint.d.ts`
    (structurally identical named call signatures).
  - **Still differing, published, genuinely narrowed (1)** —
    `mocks/createFirebaseAdminFunctionsMock.d.ts`: `taskQueueMock` (and
    `getFunctions().taskQueue`) is `Mock<(queueName: string) => { enqueue: Mock
    }>` instead of `Mock<Procedure>`. Required by the file's own
    `no-unsafe-assignment`/`no-unsafe-argument`. `enqueueMock` is back to
    `Mock<Procedure>`.
- **Consumer probe against the built `dist/`**, compiled with
  `moduleResolution: NodeNext` through the `firebase-kit-admin/mocks` entry
  point. The three calls the review cited as breaking now compile:
  `fs.doc.mockImplementation((path: string) => ({ path }))`,
  `storage.deleteMock.mockResolvedValue([{ status: 200 }])` and
  `storage.bucketMock.mockReturnValue({ name: 'my-bucket' })`, plus
  `getMetadataMock.mockResolvedValue`, `saveMock.mockImplementation` with a
  different signature, `collection.mockReturnValue`, and
  `enqueueMock.mockResolvedValue`. The probe was proved sensitive by the
  `TS2305` run above.
- **Defect 3 verified behaviourally**, not by reading the code: a throwaway
  spec armed `{ code: 'RESOURCE_EXHAUSTED' }` and asserted
  `rejects.toBe(armed)` — passes, i.e. the rejection reason is the same object,
  not an `Error` wrapping it. A second case asserts an armed `Error` rejects
  with that same instance. The file was deleted after the run; no test was added
  to the suite.
- `yarn format` (working tree clean afterwards), `yarn lint`, `yarn build`,
  `yarn test` all exit 0 **from every `dist/` and `.tsbuildinfo` deleted**.
- **Counts unchanged and reconciled**: `yarn test:unit` → **48 files / 180
  passing** for admin (client still 29/149); `yarn test:emulator` → **7 files /
  21 passing**. `grep` for `it.skip` / `it.only` / `.todo` / `xit(` across the
  package returns nothing.
- No rule disabled or downgraded; `grep` for `eslint-disable` / `@ts-ignore` /
  `@ts-expect-error` over `src/` returns exactly one hit, Okven's pre-existing
  `@ts-expect-error` in `internal/assertNever.test.ts`. `as`-token counts on the
  seven touched files are unchanged from Okven except for three occurrences of
  the English word "as" in new comments; the only real assertion in them,
  `(error as { code?: string })`, is Okven's.
- `src/` now differs from Okven in **29 files** (was 27): the firestore mock
  factory left the list, the three mock test files joined it.
  `firebase.json` and `firestore.rules` are still byte-identical.
- `yarn workspace firebase-kit-admin pack --dry-run` still lists all of
  `dist/mocks/` and neither `__mocks__` nor `__test__` nor any `*.test.*`.
- `git -C /Users/eric/Code/okven status --short` is empty.
- End-to-end tests: none — the project's test exception for library packages
  with no e2e infrastructure applies. The substitute verification is the
  147-file `.d.ts` diff, the consumer probe, the behavioural defect-3 spec, and
  the 48/180 + 7/21 reconciliation above.
