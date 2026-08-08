# Task 1.1: Root toolchain, configs, and quality commands

## Goal

Turn the empty `/Users/eric/Code/firebase-kit` repository into a complete Yarn 4
monorepo skeleton whose `yarn format`, `yarn lint`, `yarn build`, and `yarn test`
all pass, while it still contains no package source code.

## Requirements addressed

REQ-REPO-2, REQ-REPO-3, REQ-REPO-6, REQ-TOOL-1, REQ-TOOL-2, REQ-TOOL-3,
REQ-TOOL-4, REQ-TOOL-5, REQ-TOOL-6, REQ-TOOL-7, REQ-QUAL-1, REQ-QUAL-4,
REQ-QUAL-6, REQ-QUAL-6a, REQ-QUAL-7

## Background

This repository will publish three npm packages — `firebase-kit-protocol`,
`firebase-kit-client`, `firebase-kit-admin` — that currently live as workspaces
inside another project. This task builds only the shell.

**Work directly on `main`.** This phase is deliberately outside the mise
workflow: merging it in from a feature branch would put a `.mise/` directory on
`main` and trip a guard this repository is about to add.

`main` currently has one commit containing `CLAUDE.md` and
`.claude/mise-config.md`. Leave both in place.

The template to copy is `/Users/eric/Code/scdate`, a working three-package
publishing monorepo under the same GitHub account. Read its files as you go;
`_exploration_notes.md` in this directory records the details already surveyed.
Where this task says to deviate from scdate, the deviation is deliberate and the
reason is given — do not "correct" it back.

## Files to modify/create

- `package.json` — private root, `@firebase-kit/monorepo`, version `0.0.1`,
  `workspaces: ["packages/*"]`, the four quality scripts, prettier and
  lint-staged config, `packageManager`
- `.yarnrc.yml` — Yarn settings and the after-install plugin
- `.yarn/releases/yarn-4.18.0.cjs` — committed Yarn binary (mode 755)
- `.yarn/plugins/@yarnpkg/plugin-after-install.cjs` — committed plugin
- `yarn.lock` — committed
- `tsconfig.json` — solution-style, empty `references` for now
- `tsconfig.eslint.json` — typed-lint coverage for root config files
- `eslint.config.mjs` — the strict flat config
- `vitest.config.ts` — root runner defaults
- `.gitignore`, `.editorconfig`, `.prettierignore`
- `.husky/pre-commit`
- `.vscode/extensions.json`, `.vscode/settings.json`
- `LICENSE` — MIT, `Eric Vera`
- `README.md` — placeholder root readme (task 3.2 rewrites it)

## Implementation details

1. **Initialize Yarn 4.18.0.** Set the packageManager field to `yarn@4.18.0` and
   commit the Yarn release binary under `.yarn/releases/`. Copy scdate's
   `.yarnrc.yml` — `nodeLinker: node-modules`, `afterInstall: yarn
   localAfterInstall`, the `yarnPath`, and the `plugin-after-install` v0.6.0
   plugin entry with its checksum. Copy the plugin file itself from
   `/Users/eric/Code/scdate/.yarn/plugins/@yarnpkg/plugin-after-install.cjs`.

   Additionally set `npmMinimalAgeGate: 0`, which scdate lacks but
   `/Users/eric/Code/getsetdel/.yarnrc.yml` has. Without it Yarn's new-package
   cooldown can make dependabot's own bumps fail to install.

2. **Root `package.json`.** Private, named `@firebase-kit/monorepo`, version
   `0.0.1`, `type: module`, `engines.node >= 24`, `workspaces: ["packages/*"]`.

   Scripts — the names are fixed by the project configuration, not free choice:
   - `format` — prettier write across the repo. scdate has no such script;
     `/Users/eric/Code/getsetdel/package.json` does. Take getsetdel's.
   - `lint` — eslint across the repo
   - `build` — `tsc --build`
   - `test`, `test:unit`, `test:emulator` — see step 8
   - `localAfterInstall` — runs husky, tolerating failure

   **Do not copy scdate's `prepublishOnly`/`postpublish` `pinst` scripts.** Yarn
   does not run npm's `prepublishOnly` lifecycle and this root package is private
   and never published, so they would be dead configuration implying hook
   suppression is handled when it is not.

   Declare at the root every tool the quality commands invoke — the linter and
   its TypeScript plugin and JS config package, TypeScript itself, the strict
   tsconfig base, the formatter, the test runner, the git-hook and staged-file
   tooling, and the Node type definitions. Without these the commands this task
   must leave green cannot run at all. Task 2.4 later moves per-package tooling
   into the packages that invoke it.

   Include the prettier config block (`tabWidth: 2`, `semi: false`,
   `singleQuote: true`) and the lint-staged block (eslint with cache on
   `*.{ts,tsx,mjs}`, prettier write on everything else), both copied from scdate.
   Set `repository` to `git+https://github.com/ericvera/firebase-kit.git` and
   `license: MIT`.

3. **`.gitignore`.** Copy scdate's verbatim — it is the toptal
   `macos,node,yarn,visualstudiocode` template and already covers
   `node_modules/`, `dist`, `*.tsbuildinfo`, the `.vscode/*` allowlist, and the
   `.yarn/*` block that un-ignores `releases`, `plugins`, `patches`, `sdks`,
   `versions`, and `cache`.

   **Do not add a `.mise/` entry.** That directory is committed on feature
   branches by design and is kept off `main` by process and by the guard added in
   task 1.2 — never by ignoring it.

4. **`.editorconfig`, `.prettierignore`.** Copy scdate's. The `.prettierignore`
   lists `.yarn` and `.mise`.

5. **`.husky/pre-commit`.** Copy scdate's, including its nvm-sourcing preamble
   (it exists so VS Code's git integration finds node). Husky installs via the
   `afterInstall` yarn plugin calling `localAfterInstall`, not via npm's
   `prepare` lifecycle, which Yarn Berry does not run.

6. **`eslint.config.mjs`.** Copy scdate's structure exactly: `recommended` +
   `strictTypeChecked` + `stylisticTypeChecked`, `globalIgnores` for
   `**/dist/**`, `**/node_modules/**`, `.cursor`, `.github`, `.husky`, `.vscode`,
   `.yarn`, and both named rule blocks — `local:rules` (`curly`,
   `no-unused-vars` with `ignoreRestSiblings`, `line-comment-position` above,
   `prefer-function-type` off, `max-len` with code 999 / comments 80 /
   ignoreUrls) and `local:test-rules` (`no-restricted-globals` banning
   `describe` in test files).

   Set `parserOptions.project` to the root tsconfig, the eslint tsconfig, and
   `./packages/*/tsconfig.json`, with `tsconfigRootDir` from
   `import.meta.dirname`.

7. **`tsconfig.eslint.json` — take getsetdel's variant, not scdate's.** scdate
   sets `checkJs: true` without `allowJs`, which leaves `eslint.config.mjs`
   outside the typed-lint program.
   `/Users/eric/Code/getsetdel/tsconfig.eslint.json` sets `allowJs: true` and
   carries a comment explaining that it is required. Its `include` must cover
   the root `vitest.config.ts` and `eslint.config.mjs`, plus
   `packages/*/vitest.config.ts` for the configs tasks 2.2 and 2.3 will add.

8. **Make the quality commands green on an empty repository.** This is the part
   that has no template — scdate always has packages, so every shape below is
   specific to phase 1 and is replaced in task 2.1.
   - `tsconfig.json` is solution-style with `files: []`, `include: []`, and an
     **empty** `references` array. **This configuration cannot be compiled**: with
     an empty `files` list and nothing in `references`, TypeScript reports
     `error TS18002: The 'files' list in config file … is empty` and exits
     non-zero. It stops erroring the moment `references` is non-empty, which
     happens in task 2.1.
   - Therefore `build` must **not** run a real compile in phase 1. Make it a stub
     that exits 0, the same way the test scripts below are stubs. Task 2.1
     replaces it with the real project build when the first reference exists.
   - `test`, `test:unit`, and `test:emulator` must likewise exit 0 with no
     packages. Make them trivially succeed — for example echoing that there is
     nothing to run. Do **not** solve this by enabling a repository-wide "pass
     with no tests" flag: task 2.1 replaces these scripts with the real
     per-package orchestration, and a lingering blanket tolerance flag would later
     mask a runner misconfiguration.
   - `lint` and `format` work as-is over the config files.
   - Leave a comment in the root `package.json` scripts, or in the commit message,
     recording that `build`, `test`, `test:unit`, and `test:emulator` are phase-1
     stubs — so task 2.1 replaces them rather than building on top of them.

9. **Install with an immutable lockfile in CI.** Commit `yarn.lock`. The
   workflow in task 1.2 will pass the immutable flag explicitly rather than
   relying on Yarn's CI-environment default.

10. **`LICENSE`** — MIT. Copy the text from `/Users/eric/Code/scdate/LICENSE`.

11. **`README.md`** — a short placeholder naming the repository and stating the
    packages are coming. Task 3.2 replaces it.

## Testing suggestions

There is nothing to unit test — this task produces configuration only. Per the
project's test exception for library packages with no e2e infrastructure, verify
by running the quality commands directly and by a clean-clone check.

- Run `yarn install --immutable`, then `yarn format`, `yarn lint`, `yarn build`,
  `yarn test`, `yarn test:unit`, `yarn test:emulator` — all must exit 0.
- Clone the repository to a scratch directory, install, and re-run all of the
  above, to confirm nothing depends on untracked local state.
- Make a trivial commit and confirm the pre-commit hook runs lint-staged.

## Gotchas

- **An empty solution tsconfig cannot be compiled at all.** `files: []` plus an
  empty `references` gives `TS18002`, which is why `build` is a stub in this
  task. And if `references` points at a directory that has no `tsconfig.json`,
  the failure is `TS5083` (cannot read file). Neither is the "does nothing
  quietly" behavior one might expect.
- **Husky will not install via `prepare`.** Yarn Berry does not run that
  lifecycle script. The after-install plugin plus `localAfterInstall` is the only
  mechanism that works; if the hook does not appear, check the plugin is
  committed and listed in `.yarnrc.yml`, not that `prepare` is missing.
- **`.mise/` must stay un-ignored.** It is easy to "tidy up" by adding it to
  `.gitignore`; that breaks the workflow that produced this plan.
- **The typed-lint config needs project references built.** Once packages exist,
  `yarn lint` depends on `yarn build` having run. Keep that order everywhere.

## Verification checklist

- [ ] `yarn install --immutable` succeeds from a clean clone
- [ ] Root `package.json` declares every tool the quality commands invoke
- [ ] `build`, `test`, `test:unit`, `test:emulator` are stubs, recorded as such,
      and `tsconfig.json` has an empty `references` array
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test`, `yarn test:unit`,
      `yarn test:emulator` all exit 0 on the empty skeleton
- [ ] `git check-ignore -v .mise` reports no match
- [ ] `git ls-files .yarn` lists exactly the release binary and the after-install
      plugin
- [ ] Root `package.json` is `private: true` and contains no `pinst` scripts
- [ ] `tsconfig.eslint.json` sets `allowJs: true`
- [ ] Pre-commit hook fires and runs lint-staged on a test commit
- [ ] End-to-end tests: none — the project's test exception for library packages
      with no e2e infrastructure applies; substitute verification is the
      clean-clone quality-command run above
