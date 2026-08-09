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
