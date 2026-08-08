# Task 2.4: Audit and correct every package manifest

## Goal

Bring all three packages' dependency declarations into line with what they
actually use, correct the one optional-peer declaration that would break
consumers at runtime, and pin `firebase-tools` consistently.

## Requirements addressed

REQ-PKG-6, REQ-PKG-8, REQ-PKG-8a, REQ-PKG-9, REQ-PKG-9a, REQ-TOOL-7, REQ-BOOT-2a

## Background

**Work on the mise feature branch.** Tasks 2.1–2.3 copied all three packages in,
wired the workspace, and brought each to a clean lint. Their manifests are still
essentially Okven's, and Okven's manifests were written inside a repository whose
root supplied things these packages never had to declare.

The specific hazard: this repository hoists dependencies across workspaces just
as Okven does, so **a package importing something declared only at the root or by
a sibling will build, lint, and test perfectly green while shipping an incomplete
manifest.** A passing CI run is not evidence of compliance here. Compliance has
to be established by reading each package's imports against its own manifest.

Known gaps found during planning:

- **`@types/node` is declared only at Okven's root.** All three packages need it:
  `process.env` in many places, `node:crypto` in `firebase-kit-admin`, `node:path`
  in both vitest configs, and `import.meta.dirname`.
- **`firebase-kit-admin` declares three optional peers**, and one of them is
  wrong. The rule: a dependency with a runtime (value, not type-only) import
  reachable from a **production** entry point must not be optional, because the
  consumer gets no install-time warning and a module-resolution failure at
  runtime. Entry points that exist only to support a consumer's tests —
  `./testing` and `./mocks` — are exempt, since a consumer who never imports them
  never needs their dependencies.

  | Dependency                 | Value import reachable from                  | Status              |
  | -------------------------- | -------------------------------------------- | ------------------- |
  | `betterbe`                 | `./validation` — **production**              | must become required |
  | `firestore-snapshot-utils` | `./testing` only                             | stays optional      |
  | `vitest`                   | `./testing` and `./mocks` only               | stays optional      |

  Concretely: `betterbe`'s `ValidationError` is a value import in
  `src/validation/internal/validateSchema.ts`, and `src/validation/index.ts`
  re-exports from that subtree. `firestore-snapshot-utils` is imported for values
  in `src/testing/getDBSnapshot.ts`, `getDBChanges.ts`, and `getDBChangesDiff.ts`.
  `vitest` is imported for values in five `src/mocks/*` files and in
  `src/testing/expectSuccessResult.ts` and
  `src/testing/emulator/registerEmulatorHooks.ts`.

  **Making `vitest` a required peer would be actively wrong** — it would force
  every production consumer to install a test framework.

- **`firebase-kit-client` declares `getsetdel` as a required peer at `^2.0.0`
  while `getsetdel` is published at `3.0.0`.** This stays exactly as it is. It is
  a deliberate, maintainer-approved decision to keep this work's delta minimal;
  migrating to `getsetdel` 3 is separate later work. Do not widen the range.

- **`firebase-tools` is declared at the root** (task 1.3) and will also be
  declared by `firebase-kit-admin`. Both must pin the **same exact version** —
  the CI emulator cache key comes from resolving that name across the dependency
  graph, and two differing locators produce a malformed key.

## Files to modify/create

- `packages/firebase-kit-protocol/package.json`
- `packages/firebase-kit-client/package.json`
- `packages/firebase-kit-admin/package.json`
- `package.json` — root, if the audit moves anything

## Implementation details

1. **Audit each package by reading its imports, not by running CI.** For each
   package, collect every bare module specifier appearing anywhere under `src/`
   (including test files and the vitest config), and classify each as: a runtime
   dependency, a peer the consumer supplies, a type-only import, or a development
   dependency used solely by tests and tooling. Compare that set against the
   manifest and reconcile in both directions — nothing declared that is unused,
   nothing used that is undeclared.

   The full set of bare specifiers across all three packages, confirmed during
   planning, is: `firebase-kit-protocol`, `firebase`/`firebase-admin`/
   `firebase-functions` subpaths, `betterbe`, `getsetdel`,
   `firestore-snapshot-utils`, `scdate-testing`, `fake-indexeddb/auto`, `vitest`,
   `node:path`, `node:crypto`.

2. **Declare `@types/node` where it is needed.** Follow the template repository's
   convention, where each package declares its own development dependencies
   rather than relying on the root.

3. **Change `betterbe` from an optional peer to a required peer** in
   `firebase-kit-admin`. Leave `firestore-snapshot-utils` and `vitest` optional.
   This is the only optional-peer change in this task.

4. **Leave `getsetdel` at `^2.0.0`** in `firebase-kit-client`. Task 3.2 will note
   the required major in that package's README so a consumer is not surprised by
   the resolution conflict.

5. **Pin `firebase-tools` identically** at the root and in `firebase-kit-admin`,
   at an exact version.

6. **Declare development tooling per package.** The linter, TypeScript, and the
   strict tsconfig base are invoked by each package's own `lint` and `build`
   scripts, so each package declares them — this is what the template repository
   does. Tooling with no per-package script (the formatter, the git-hook
   machinery) may stay at the root alone.

7. **Confirm `sideEffects: false` survived** on all three packages. Consumer
   bundlers rely on it for tree-shaking, and it is easy to drop when rewriting a
   manifest.

8. **Reinstall and commit the lockfile** so the manifest changes are reflected.

## Testing suggestions

Per the project's test exception for library packages with no e2e infrastructure,
verify structurally and by the existing suites:

- The full suite still passes after the manifest changes: `yarn build`,
  `yarn lint`, `yarn test`.
- For each package, diff the collected bare-specifier set against the manifest
  and confirm the reconciliation is complete in both directions. Record the
  result — this is the only real evidence for this task, since CI passing proves
  nothing here.
- Confirm `yarn info firebase-tools --name-only --json` still returns exactly one
  line after the second declaration is added.
- Confirm the CI emulator cache key resolves correctly on the next run.

## Gotchas

- **Green CI does not verify this task.** Hoisting hides every missing
  declaration. The audit is the deliverable; the test run is not.
- **Type-only imports do not need a runtime peer.** `betterbe` is imported both
  as a type (`ObjectValidator`) and as a value (`ValidationError`) — it is the
  value import that forces the change. Do not promote a dependency that is only
  ever imported as a type.
- **Do not "fix" the `getsetdel` range.** It looks stale because it is; that is a
  recorded decision, not an oversight.
- **Do not promote `vitest`.** The rule in the Background reads as if it applies,
  and it does not — `./testing` and `./mocks` are exempt by design.
- **Two `firebase-tools` specifiers break the cache key** in a way that surfaces
  as a confusing CI cache error, not as a dependency error.

## Verification checklist

- [ ] For each package, the bare-specifier set was collected and reconciled
      against the manifest in both directions, and the result recorded
- [ ] `@types/node` is declared by every package that needs it
- [ ] `firebase-kit-admin` declares `betterbe` as a **required** peer
- [ ] `firestore-snapshot-utils` and `vitest` remain **optional** peers
- [ ] `firebase-kit-client` still declares `getsetdel` at `^2.0.0`, unwidened
- [ ] `firebase-tools` is pinned to the same exact version at the root and in
      `firebase-kit-admin`; `yarn info firebase-tools --name-only --json` returns
      one line
- [ ] Each package declares the tooling its own scripts invoke
- [ ] `sideEffects: false` present on all three packages
- [ ] Lockfile updated and committed
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test` all pass
- [ ] End-to-end tests: none — the project's test exception for library packages
      with no e2e infrastructure applies; substitute verification is the
      import-versus-manifest reconciliation above, since CI cannot detect the
      defect class this task addresses
