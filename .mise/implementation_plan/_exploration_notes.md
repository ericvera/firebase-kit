# Exploration Notes

Reference material for every task in this plan. Re-read this instead of
re-exploring the source repositories.

## Source packages (to be copied FROM, never modified)

`/Users/eric/Code/okven/packages/firebase-kit-{protocol,client,admin}`

| Package    | Root files beyond `src/`                                              | `src/` shape                                                                                                                  |
| ---------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `protocol` | `package.json`, `tsconfig.json`                                        | 3 files, no subdirs: `index.ts`, `constants.ts`, `types.ts`                                                                     |
| `client`   | `package.json`, `tsconfig.json`, `vitest.config.ts`                    | 4 loose files + `__mocks__/ __test__/ callable/ connectivity/ firestore/ rate-limit/ runtime/ testing/`                         |
| `admin`    | `package.json`, `tsconfig.json`, `vitest.config.ts`, `firebase.json`, `firestore.rules` | 4 loose files + `__mocks__/ __test__/ auth/ callable/ errors/ firestore/ internal/ mocks/ runtime/ tasks/ testing/ validation/` |

**Verified: zero coupling to Okven at the source level.** No relative import
escapes any package directory; no `@okv/*` imports; no absolute paths. Every bare
specifier resolves to public npm, `node:*`, or `firebase-kit-protocol`.

### Test counts (reconcile against these after the move)

| Package    | Unit files | Unit `it()` | Emulator files | Emulator `it()` |
| ---------- | ---------- | ----------- | -------------- | --------------- |
| `protocol` | 0          | 0           | 0              | 0               |
| `client`   | 29         | 149         | 0              | 0               |
| `admin`    | 48         | 180         | 7              | 21              |

`admin`'s 7 emulator files live in exactly two directories: `src/firestore/`
(3 files) and `src/firestore/internal/` (4 files).

### Entry point → source mapping

- `protocol`: string-form `"exports": "./dist/index.js"` ← `src/index.ts`
- `client` (7): `.` `./callable` `./connectivity` `./firestore` `./rate-limit`
  `./runtime` `./testing`
- `admin` (10): `.` `./auth` `./callable` `./errors` `./firestore` `./mocks`
  `./runtime` `./tasks` `./testing` `./validation`

`admin/src/internal/` (`assertNever`) is deliberately not exported by any
subpath. `__test__/` and `__mocks__/` are excluded by `files`.

### Things inherited from Okven that must be recreated locally

- **No package has an `eslint.config.*`** — `"lint": "eslint ."` currently walks
  up to `/Users/eric/Code/okven/eslint.config.mjs`. After the move every package
  fails with "no config found" until the new repo supplies a root config.
- **Prettier config exists only as the `"prettier"` key in Okven's root
  `package.json`** (`tabWidth: 2, semi: false, singleQuote: true`).
- **`@types/node` is declared only at Okven's root.** These packages need it:
  `process.env` (many sites), `node:crypto` (admin), `node:path` (both vitest
  configs), `import.meta.dirname`.
- **`dist/` and `*.tsbuildinfo` are ignored only by Okven's root `.gitignore`.**
- `tsconfig.json` `references` in client and admin both point at
  `../firebase-kit-protocol` — these survive only if the three stay siblings.

### Hard-coded values that move with the code

- `admin/package.json` `ci:test-emulator`: `--project demo-admin-tests`,
  `--only auth,firestore`, `TZ=Etc/Universal`, prefixed by `tsc --build &&`, and
  **no `--config` path** — it depends on running with the admin package as cwd.
- `admin/firebase.json`: auth `9298`, firestore `8281`, hub `4481`, logging
  `4581`, host `127.0.0.1`, `singleProjectMode: false`, `ui.enabled: false`.
  (The odd port numbers exist to avoid colliding with Okven's own emulators;
  after the move that constraint is gone but the numbers are harmless.)
- `admin/src/__test__/setup/vi.setup.ts`: `projectIdBase: 'demo-admin-tests'`,
  `firestoreHost: '127.0.0.1:8281'`, `authHost: '127.0.0.1:9298'`,
  `isolationSeed: import.meta.url`. **Must stay in sync with `firebase.json` and
  the `ci:test-emulator` script.**
- `admin/src/__test__/utils/setFakeTimer.ts:3`:
  `const TestTimeZone = 'America/Puerto_Rico'`, carrying the comment "The package
  cannot reach the product's shared time-zone constant" — an Okven product fossil
  in what is about to become a standalone library's test utilities.
- `admin/src/testing/emulator/internal/deleteEmulatorFirestoreData.ts:15`:
  hardcoded REST path `.../databases/(default)/documents`.
- `admin/src/__test__/db/testDB.ts`: `databaseId: 'test-database-id'`,
  `emulatorDatabaseId: '(default)'` (the reset path requires `(default)`).

### vitest configs (verbatim shape)

`client/vitest.config.ts` — a single **unnamed** project:

```
test: { root: <pkg>/src, exclude: [node_modules, dist], mockReset: true,
        setupFiles: ['./__test__/setup/vi.setup.ts'] }
```

`admin/vitest.config.ts` — **two named projects**, `unit` and `emulator`, split
purely by filename (`**/*.emulator.test.ts` vs `**/*.test.ts`), each with
`root: <pkg>/src` and `mockReset: true` repeated (projects do not inherit the
root `test` block). Only `emulator` has `setupFiles`.

Both anchor `root` at `src` **deliberately**, so that `src/__mocks__/<module>/`
directories are discovered as automatic module shims while staying inside the
tsconfig `rootDir`. Anchoring at the package directory instead leaves tests
running but silently resolving real modules instead of the shims.

`client/src/__mocks__/`: `firebase/app/`, `getsetdel/`.
`admin/src/__mocks__/`: `firebase-admin/app/`, `firebase-admin/auth/`,
`firebase-admin/functions/`, `firebase-functions/`.

## Template repository: `/Users/eric/Code/scdate`

The shape to copy. Root is `@scdate/monorepo`, `private: true`,
`workspaces: ["packages/*"]`, lockstep version across root + all packages.

### Root scaffolding files

- `.editorconfig` — 10 lines: `root = true`, LF, final newline, and for
  `{js,json,yml}` utf-8 / space / 2.
- `.gitignore` — the toptal `macos,node,yarn,visualstudiocode` template
  verbatim, no additions. Already covers `*.tsbuildinfo`, `dist`, the
  `.vscode/*` allowlist block, and the `.yarn/*` block with `!.yarn/releases`,
  `!.yarn/plugins`, `!.yarn/patches`, `!.yarn/sdks`, `!.yarn/versions`,
  `!.yarn/cache`.
- `.prettierignore` — `.yarn` and `.mise`.
- `.yarnrc.yml` — `afterInstall: yarn localAfterInstall`,
  `nodeLinker: node-modules`, the `plugin-after-install` v0.6.0 entry (checksum
  `0a2a35fb…`), `yarnPath: .yarn/releases/yarn-4.18.0.cjs`.
- `.yarn/` committed set: `releases/yarn-4.18.0.cjs` (mode 755) and
  `plugins/@yarnpkg/plugin-after-install.cjs` only.
- `.husky/pre-commit` — sources nvm if present, then `yarn lint-staged`.
- `.vscode/` — `extensions.json` (eslint, prettier, vitest.explorer) and
  `settings.json` (prettier default formatter, format on save, organize imports).
- `tsconfig.json` — solution style: `files: []`, `include: []`, `references` to
  each package.
- `vitest.config.ts` — `{ globals: true, mockReset: true, exclude: [node_modules,
  dist, build] }`.
- `LICENSE` — MIT at root only. **scdate has no per-package LICENSE** (this repo
  will, per REQ-PKG-3a).

### Root `package.json` (scdate)

`build: tsc --build`, `lint: eslint .`, `test: vitest run`, `smoke`,
`localAfterInstall: husky || true`, `prepublishOnly`/`postpublish` running
`pinst`. `prettier` block `{tabWidth: 2, semi: false, singleQuote: true}`.
`lint-staged` `{"*.{ts,tsx,mjs}": "eslint --cache", "*": "prettier
--ignore-unknown --write"}`. `packageManager: yarn@4.18.0`.

**scdate has no `format` script — getsetdel does (`prettier --write .`).** This
repo needs one (REQ-QUAL-1).

**Do not copy `prepublishOnly`/`postpublish`** — forbidden by REQ-QUAL-7.

### `eslint.config.mjs` (scdate) — the config REQ-QUAL-4 mandates

`eslint.configs.recommended` + `tseslint.configs.strictTypeChecked` +
`tseslint.configs.stylisticTypeChecked`, with
`parserOptions.project: ['./tsconfig.json', './tsconfig.eslint.json',
'./packages/*/tsconfig.json']` and `tsconfigRootDir: import.meta.dirname`.
`globalIgnores(['**/dist/**', '**/node_modules/**', '.cursor', '.github',
'.husky', '.vscode', '.yarn'])`. Block `local:rules`: `curly`,
`@typescript-eslint/no-unused-vars` with `ignoreRestSiblings: true`,
`line-comment-position: above`, `@typescript-eslint/prefer-function-type: off`,
`max-len` `{code: 999, comments: 80, ignoreUrls: true}`. Block
`local:test-rules` for test files: `no-restricted-globals` banning `describe`.

### `tsconfig.eslint.json` — use **getsetdel's** variant, not scdate's

scdate sets `checkJs: true` **without** `allowJs`, which likely leaves
`eslint.config.mjs` outside the typed-lint program. getsetdel sets
`allowJs: true` with a comment stating it is required. Copy getsetdel's, and
have `include` cover the root config files plus `packages/*/vitest.config.ts`.

### Per-package `tsconfig.json` (scdate)

`extends: ["@tsconfig/strictest/tsconfig.json"]`, `incremental`, `composite`,
`target/lib ESNext`, `module/moduleResolution NodeNext`, `rootDir: src`,
`outDir: dist`, **`removeComments: false`** ("Keep comments. Otherwise
intellisense does not work." — REQ-QUAL-5a; the Okven copies say `true` and MUST
be changed), `preserveConstEnums`, `forceConsistentCasingInFileNames`,
`allowJs: false`, `checkJs: false`, `skipLibCheck: true`, `files: []`,
`include: ["src"]`, plus `references`.

### `.github/` (scdate) — three files

`workflows/publish.yml`, `workflows/dependabot.yml`, `dependabot.yml`.

`publish.yml` mechanics, in order: checkout@v7 with `fetch-depth: 0` →
setup-node@v7 (node 24, npm registry) → `yarn` → `yarn build` → `yarn lint` →
`yarn test` → `TriPSs/conventional-changelog-action@v6` with
`output-file: false`, `skip-commit`, `skip-tag`, `git-push: false` (it only
*computes*) → `yarn workspaces foreach --all version <v> --deferred` →
`yarn version apply --all` → `stefanzweifel/git-auto-commit-action@v7` with
`chore(release): v<version> [skip ci]` → one
`yarn npm publish --access public` step per package with `working-directory` →
`ncipollo/release-action@v1` using `steps.changelog.outputs.tag`.

`concurrency: {group: github.ref, cancel-in-progress: true}` — **this repo must
set `cancel-in-progress: false`** (REQ-PUB-8).

`dependabot.yml` workflow auto-merge condition excludes only *github-actions*
majors — **this repo excludes all majors** (REQ-DEP-4). Note it runs
`lint` before `build`, which is wrong for typed linting that needs project
references built; this repo uses build → lint → test everywhere.

`.github/dependabot.yml` — npm at `/` plus github-actions at `/`, weekly, with
`dev-non-major` / `prod-non-major` / `actions-non-major` groups.

### getsetdel-only settings worth taking

`.yarnrc.yml` additionally sets `npmMinimalAgeGate: 0`, which disables Yarn's
new-package cooldown. Without it dependabot bumps can fail to install.

## Composite action to port: `/Users/eric/Code/okven/.github/actions/setup-firebase-tools/action.yml`

Two steps: `actions/setup-java@v5` (temurin, 21), then resolve the
`firebase-tools` version via `yarn info firebase-tools --name-only --json` into
`$GITHUB_OUTPUT`, then `actions/cache@v5` over `~/.cache/firebase/emulators`
keyed `firebase-emulators-${{ runner.os }}-${{ version }}`.

The resolve step reads the whole dependency graph, so root and
`firebase-kit-admin` must pin the **same exact** `firebase-tools` version
(Okven pins `15.23.0` in both) — two locators would write a multi-line value and
produce a malformed cache key.

## Guard to port: `/Users/eric/Code/okven/.github/workflows/pr-checks.yml`

The `no-mise-directory` job: `git ls-files -- '.mise/' '**/.mise/'`, fail with an
`::error::` if anything matches. In this repo it becomes a **step** in
`publish.yml` positioned after build/lint/test and before the changelog/version/
publish steps (REQ-GUARD-2).
