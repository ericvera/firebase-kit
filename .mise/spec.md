# Spec: update-packages

## What

The owner bumped dependencies in the root and package `package.json` files and in `yarn.lock`. Two of the bumps cross a major that the published peer ranges do not cover:

- `firebase-kit-admin` dev-depends on `betterbe` `^6.0.0`, but its peer still says `^4.1.0`.
- `firebase-kit-client` dev-depends on `firebase` `^13.0.0`, but its peer still says `^12.18.0`.

The packages are built and tested only against betterbe v6 and firebase v13, so the peer ranges move to those majors (replace, not widen, per the goals decision). Everything else (lint, build, unit, emulator tests) already passes. The owner's other bumps are committed unchanged.

## Design

- `packages/firebase-kit-admin/package.json` `peerDependencies.betterbe`: `^4.1.0` becomes `^6.0.0`.
- `packages/firebase-kit-client/package.json` `peerDependencies.firebase`: `^12.18.0` becomes `^13.0.0`.
- `yarn install` refreshes the workspace entries in `yarn.lock`, which record each workspace's peer ranges.
- The owner's uncommitted bumps in `package.json`, `packages/firebase-kit-admin/package.json`, `packages/firebase-kit-client/package.json`, `packages/firebase-kit-protocol/package.json` and `yarn.lock` are kept as they are.
- READMEs do not change. They point at `npm info <pkg> peerDependencies` and the admin betterbe snippet (`packages/firebase-kit-admin/README.md:338-357`) already uses the v6 API. A `yarn pack` consumer check proves the snippet against betterbe v6.
- Release: replacing a peer range is a breaking change (CLAUDE.md). The squashed merge commit must carry `!` after the type (for example `feat!: require betterbe v6 and firebase v13`) or a `BREAKING CHANGE:` body. All three packages take the next major together.
- Out of scope: the existing `scdate-testing` peer mismatch (`vitest ^4` vs 5.0.3) and the firebase compat internals flagged by `yarn explain peer-requirements`.
- Nothing is removed.

## Hard-to-undo

- Public API change: the published peer ranges are replaced (`betterbe` `^4.1.0` to `^6.0.0` in firebase-kit-admin, `firebase` `^12.18.0` to `^13.0.0` in firebase-kit-client). Consumers on betterbe v4/v5 or firebase v12 lose support. The squashed commit must be marked breaking (`!` or `BREAKING CHANGE:`), so on publish all three packages take a new major version.

## Task index

| Task file | What it does | Files |
| --- | --- | --- |
| `01_01_peer_ranges.md` | Replace the betterbe and firebase peer ranges, refresh the lockfile, keep the owner's bumps, validate with quality commands and a `yarn pack` consumer check of the admin betterbe snippet | `package.json`, `packages/firebase-kit-admin/package.json`, `packages/firebase-kit-client/package.json`, `packages/firebase-kit-protocol/package.json`, `yarn.lock` |
