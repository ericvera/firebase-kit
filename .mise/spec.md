# Spec: update-packages

## What

The owner bumped dependencies in the root and package `package.json` files and in `yarn.lock`. Two of the bumps cross a major that the published peer ranges do not cover:

- `firebase-kit-admin` dev-depends on `betterbe` `^6.0.0`, but its peer still says `^4.1.0`.
- `firebase-kit-client` dev-depends on `firebase` `^13.0.0`, but its peer still says `^12.18.0`.

The packages are built and tested only against betterbe v6 and firebase v13, so the peer ranges move to those majors (replace, not widen, per the goals decision). The owner's other bumps are committed unchanged.

The branch is behind `origin/main` (`5a6efbe chore(release): v4.0.0` plus dependabot dev-dependency bumps `185ffbc`, `d09d6a0` and their merge commits). Those commits edit the same devDependency lines, every package `"version"` (3.0.0 to 4.0.0) and `yarn.lock`, so the branch merges `origin/main` first and validates the merged tree.

## Design

- First, the owner's uncommitted bumps are committed as they are, then `origin/main` is merged into the branch. Conflicts resolve to the owner's dependency versions (each is equal to or newer than origin's) together with origin's `"version": "4.0.0"` in every package. `yarn.lock` resolves to the owner's side and `yarn install` regenerates it. All validation runs on the merged tree.
- `packages/firebase-kit-admin/package.json` `peerDependencies.betterbe`: `^4.1.0` becomes `^6.0.0`.
- `packages/firebase-kit-client/package.json` `peerDependencies.firebase`: `^12.18.0` becomes `^13.0.0`.
- `yarn install` refreshes the workspace entries in `yarn.lock`, which record each workspace's peer ranges.
- The owner's uncommitted bumps in `package.json`, `packages/firebase-kit-admin/package.json`, `packages/firebase-kit-client/package.json`, `packages/firebase-kit-protocol/package.json` and `yarn.lock` are kept as they are.
- A copy of `yarn.lock` saved after the merge and before the peer-edit `yarn install` is the baseline for checking that the peer edit changes only the workspace entries' `peerDependencies`.
- READMEs do not change. They point at `npm info <pkg> peerDependencies` and the admin betterbe snippet (`packages/firebase-kit-admin/README.md:338-357`) already uses the v6 API. A `yarn pack` consumer check proves the snippet against betterbe v6. The same check compiles the client README snippets that import firebase directly (`packages/firebase-kit-client/README.md:406-455` `src/firebase/trackSpaces.ts`, `getAuth` from `firebase/auth`, and `:552-596` `src/spaces/spaceReads.ts`, `doc`/`DocumentReference`/`Firestore` from `firebase/firestore/lite`) against firebase v13.
- Release: replacing a peer range is a breaking change (CLAUDE.md). The squashed merge commit must carry `!` after the type (for example `feat!: require betterbe v6 and firebase v13`) or a `BREAKING CHANGE:` body. All three packages take the next major together. Tag `v4.0.0` already exists, so this release publishes as v5.0.0.
- Out of scope: the existing `scdate-testing` peer mismatch (`vitest ^4` vs 5.0.3) and the firebase compat internals flagged by `yarn explain peer-requirements`.
- Nothing is removed.

## Hard-to-undo

- Public API change: the published peer ranges are replaced (`betterbe` `^4.1.0` to `^6.0.0` in firebase-kit-admin, `firebase` `^12.18.0` to `^13.0.0` in firebase-kit-client). Consumers on betterbe v4/v5 or firebase v12 lose support. The squashed commit must be marked breaking (`!` or `BREAKING CHANGE:`), so on publish all three packages take a new major version, v5.0.0 (tag `v4.0.0` exists).
- Git history: `origin/main` is merged into `feat/update-packages` (a merge commit on the branch). It is squashed away on ship.

## Task index

| Task file | What it does | Files |
| --- | --- | --- |
| `01_01_peer_ranges.md` | Commit the owner's bumps, merge `origin/main` (owner's dependency versions, origin's 4.0.0 versions), replace the betterbe and firebase peer ranges, refresh the lockfile, validate with quality commands and a `yarn pack` consumer check of the admin betterbe snippet and the client firebase snippets | `package.json`, `packages/firebase-kit-admin/package.json`, `packages/firebase-kit-client/package.json`, `packages/firebase-kit-protocol/package.json`, `yarn.lock` |
