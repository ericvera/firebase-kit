I just updated packages. Fix any issues and validate the changes.

## Investigation

Working tree checked with the project's commands. `yarn lint`, `yarn build`, `yarn test:unit` (admin 227/227, client 240/240) and `yarn test:emulator` (21/21) all pass. The gap is two peer ranges that no longer match the dev versions.

- **betterbe mismatch:** packages/firebase-kit-admin/package.json:69 moves the dev dep to `^6.0.0` (two majors up). The peer at :56 still says `^4.1.0`, so the code is built and tested only against v6 while promising v4 to consumers.
- **firebase mismatch:** packages/firebase-kit-client/package.json:63 moves the dev dep to `^13.0.0` (one major up). The peer at :50 still says `^12.18.0`.
- **Code that uses betterbe:** packages/firebase-kit-admin/src/validation/internal/validateSchema.ts:1-2 (`ObjectValidator`, `ValidationError`, an exhaustive `constraint.code` switch with `assertNever` at :83) and src/validation/validateSchemaAndTrim.ts:1. Both compile against v6, so no constraint code was added or removed.
- **README snippet:** packages/firebase-kit-admin/README.md:338-357 matches the v6 API (`object<T>(schema)`). It can be verified only through `yarn pack` into a consumer project (config test exception).
- **READMEs:** both point at `npm info … peerDependencies` (admin README:69-71, client README:66-68). They must not restate ranges (CLAUDE.md).
- **Other bumps:** `@types/node`, eslint, firebase-tools 15.32.1 (pinned), lint-staged, prettier, typescript-eslint, vite, vitest, firebase-admin `^14.5.0` (peer `^14.3.0` still covers it), plus yarn.lock. None of them break anything.
- **Broken before this branch:** scdate-testing 7.1.2 declares peer `vitest ^4` but gets 5.0.3 (`yarn explain peer-requirements`). The other ✘ entries are firebase compat internals.
- **Hard to undo:** replacing a peer range counts as breaking (CLAUDE.md). The squashed commit would need `!` or `BREAKING CHANGE:`, and all three packages would take the same major. Widening (`^4.1.0 || ^6.0.0`, `^12.18.0 || ^13.0.0`) is a minor, but nothing in the repo tests the old majors.
- **Open scope:** goals.md doesn't say whether to replace or widen the betterbe and firebase peer ranges.

## Open questions

1. betterbe and firebase peer ranges: replace them with the new majors, or widen them?
