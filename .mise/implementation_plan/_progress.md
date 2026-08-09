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
