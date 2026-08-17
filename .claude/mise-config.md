# Mise Configuration

Mise directory: .mise/
Branch convention: feat/<slug> for features, fix/<slug> for bug fixes
Ship: merge (squash)

## Quality commands

- Format: yarn format
- Check:
  - yarn lint
  - yarn build
- Unit tests: match the command to the change — `yarn test:unit` by default; when the change touches code covered by `*.emulator.test.ts` (currently only `firebase-kit-admin`), run `yarn test:emulator` too. `yarn test` runs both and is what the release workflow gates on.

## Test conventions

Vitest. Tests are colocated with their source as `src/<name>.test.ts`. Tests
needing a live Firestore/Auth emulator are named `src/<name>.emulator.test.ts`
and run as a separate vitest project via `firebase emulators:exec` against
project `demo-admin-tests`. Shared fixtures live in `src/__test__/`, module
shims in `src/__mocks__/<module>/index.ts` — including for third-party packages
and their transitive dependencies; never inline a `vi.mock` factory in the setup
file. vitest does not auto-apply a `__mocks__` folder to a node_modules package,
so each such module still needs a bare `vi.mock('<module>')` call in
`src/__test__/setup/vi.setup.ts`. Every vitest project sets `mockReset: true`.

## Test exceptions

- No e2e/browser infrastructure exists (library packages, no UI) — verify with unit tests, emulator tests, and manual verification
- Consumer-facing wiring (README snippets, package `exports`, publish workflow) — the repo's own tests import source directly and cannot exercise them; verify by packing the tree with **`yarn pack`** (never `npm pack` — only Yarn's packer rewrites the `workspace:` protocol to a concrete version, so an npm-packed tarball of a dependent package is uninstallable) into a throwaway consumer project outside the repo and running the documented snippets verbatim (extract each block to the path in its header comment). Reading the snippets is not verification.

## Models

- implementer: opus
- explore: opus
- retrospective: opus
