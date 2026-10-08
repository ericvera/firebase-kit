# 01_01 Replace the betterbe and firebase peer ranges

## Goal

Make the published peer ranges match the dependency majors the packages are now built and tested against. The `betterbe` peer of `firebase-kit-admin` becomes `^6.0.0` and the `firebase` peer of `firebase-kit-client` becomes `^13.0.0`. The owner's uncommitted dependency bumps are committed with this change unchanged.

## Files to modify/create

- `packages/firebase-kit-admin/package.json` (peer range edit, plus the owner's existing bumps)
- `packages/firebase-kit-client/package.json` (peer range edit, plus the owner's existing bumps)
- `yarn.lock` (refreshed by `yarn install`, plus the owner's existing changes)
- `package.json` (owner's existing bumps, commit unchanged)
- `packages/firebase-kit-protocol/package.json` (owner's existing bump, commit unchanged)

## Background

- This is a Yarn (berry) monorepo of three published packages, `firebase-kit-admin`, `firebase-kit-client` and `firebase-kit-protocol`, versioned together.
- The working tree already holds the owner's dependency bumps (run `git diff` to see them). Among them, `packages/firebase-kit-admin/package.json` devDependencies moved `betterbe` to `^6.0.0`, and `packages/firebase-kit-client/package.json` devDependencies moved `firebase` to `^13.0.0`. Do not revert or alter any of these bumps.
- With those bumps, `yarn lint`, `yarn build`, `yarn test:unit` and `yarn test:emulator` all pass already. The only defect is that `peerDependencies` still promise the old majors: `betterbe` `^4.1.0` (admin `package.json`, `peerDependencies` block around line 56) and `firebase` `^12.18.0` (client `package.json`, `peerDependencies` block around line 50).
- Decision from the owner: replace the ranges, do not widen them (no `||`). Nothing in the repo tests the old majors.
- betterbe is used in `packages/firebase-kit-admin/src/validation/internal/validateSchema.ts` and `packages/firebase-kit-admin/src/validation/validateSchemaAndTrim.ts`. Both compile against v6 already, so no source change is needed.
- READMEs stay unchanged. They point at `npm info <pkg> peerDependencies` and must never restate a version range (CLAUDE.md). The betterbe snippet at `packages/firebase-kit-admin/README.md:338-357` (header comment `// src/spaces/schemas.ts`) already uses the v6 API.
- Release impact: replacing a peer range is breaking. The commit for this task should use a breaking type, for example `feat!: require betterbe v6 and firebase v13`, so the squashed merge publishes a new major.

## Guides

None. The mise config has no Skills & guides entries.

## Implementation details

1. In `packages/firebase-kit-admin/package.json`, set `peerDependencies.betterbe` to `"^6.0.0"`.
2. In `packages/firebase-kit-client/package.json`, set `peerDependencies.firebase` to `"^13.0.0"`.
3. Run `yarn install` from the repo root so the workspace entries in `yarn.lock` record the new peer ranges. Check `git diff yarn.lock` shows only workspace-entry peer changes beyond what the owner already had.
4. Run `yarn format`.
5. Commit all five files together with a breaking commit message (`!` after the type).

## Gotchas

- Do not widen to `^4.1.0 || ^6.0.0` or `^12.18.0 || ^13.0.0`. The owner chose replace.
- Do not touch the `vitest` peer or the `scdate-testing` peer mismatch (`vitest ^4` vs 5.0.3). It predates this branch and is out of scope.
- Do not edit READMEs to mention versions.
- Use `yarn pack`, never `npm pack`. Only Yarn's packer rewrites the `workspace:` protocol, so an npm-packed `firebase-kit-admin` tarball is uninstallable.
- The consumer project must live outside the repo (for example in a temp dir) so Yarn does not treat it as part of the workspace. Delete it afterwards and leave no tarballs in the repo.

## Verification

Tests to run:

- `yarn lint` and `yarn build` (Check).
- `yarn test:unit` (admin and client suites).
- `yarn test:emulator` (admin emulator suite, because betterbe is used by admin validation code).

Tests this task writes: none. The change is manifest-only and no repo test can exercise published peer ranges or README snippets (config Test exception for consumer-facing wiring).

Substitute check (config Test exception):

1. `yarn pack` both `packages/firebase-kit-protocol` and `packages/firebase-kit-admin` (admin depends on protocol via `workspace:*`, which the packer rewrites to a concrete version).
2. In a throwaway directory outside the repo, create a TypeScript consumer project (`"type": "module"`, `moduleResolution` `nodenext` or `bundler`, `strict`). Install both tarballs plus `betterbe@^6`, `firebase-admin@^14`, `firebase-functions@^7` and `typescript`.
3. Confirm the installer reports no unmet peer for `betterbe` against `firebase-kit-admin` (for example `npm ls betterbe` shows no `invalid`/`UNMET PEER` entry).
4. Extract the README block at `packages/firebase-kit-admin/README.md:338-357` verbatim to `src/spaces/schemas.ts` (its header path) and run `npx tsc --noEmit`. It must compile with no errors.
5. Optionally run a tiny script calling `validateRenameSpace(undefined, { spaceId: 's', name: '  x  ' })` and check it resolves with `name` trimmed to `'x'`.
6. Inspect the packed `package.json` of `firebase-kit-client` (`yarn pack` it too, then `tar -xOf <tgz> package/package.json`) and confirm `peerDependencies.firebase` is `^13.0.0`.
