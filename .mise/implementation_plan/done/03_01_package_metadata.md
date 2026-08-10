# Task 3.1: Publication metadata and tarball shape

## Goal

Give each package the metadata an npm package page needs, add per-package
licenses, and make each published tarball contain exactly what it should.

## Requirements addressed

REQ-PKG-3, REQ-PKG-3a, REQ-PKG-5, REQ-PKG-7

## Background

**Work on the mise feature branch.** Tasks 2.1–2.4 landed all three packages with
correct dependency declarations and a clean lint. What remains before these can
be published as real, discoverable packages is metadata and packaging.

These packages were never published before, so their manifests carry only what
was needed inside a private monorepo. None declares a description, keywords, or a
repository subdirectory, and none has its own license file.

Two facts about packing shape this task:

- **The packing tool always includes** a package's own `package.json`, and any
  root-level `readme*`, `license*`, and `changelog*` file **from the package
  directory** — but never one from the monorepo root. So the MIT `LICENSE` at the
  repository root does not reach any tarball. Each package needs its own copy.
  The template repository has this gap; this repository deliberately does not.
- **`firebase-kit-admin`'s `./mocks` is a published production entry point**, not
  test scaffolding, despite the name. Only `__mocks__/` (module shims) and
  `__test__/` (fixtures) are excluded, along with `*.test.*` files.

Entry points that must be preserved exactly as they are today:
- `firebase-kit-protocol`: the string form, resolving to `.`
- `firebase-kit-client` (7): `.`, `./callable`, `./connectivity`, `./firestore`,
  `./rate-limit`, `./runtime`, `./testing`
- `firebase-kit-admin` (10): `.`, `./auth`, `./callable`, `./errors`,
  `./firestore`, `./mocks`, `./runtime`, `./tasks`, `./testing`, `./validation`

None of the three declares `main` or `types`, and that is intentional — types
resolve through the `exports` map's `.js` → `.d.ts` sibling rule under modern
module resolution. Preserving the entry points unchanged is a requirement, so do
not add `main`/`types` "for compatibility"; that would be an API change.

## Files to modify/create

- `packages/firebase-kit-protocol/package.json`, `LICENSE`
- `packages/firebase-kit-client/package.json`, `LICENSE`
- `packages/firebase-kit-admin/package.json`, `LICENSE`

## Implementation details

1. **Add a `LICENSE` file to each package**, copying the MIT text from the
   repository root `LICENSE`. Verify afterwards that it actually lands in the
   tarball (step 6) rather than assuming.

2. **Add a description to each package.** One sentence, written for someone
   scanning npm search results — what the package is for, not how it is built.
   Distinguish the three clearly: the shared protocol types and constants; the
   client-side Firebase toolkit; the Firebase Admin SDK toolkit.

3. **Add keywords to each package.** The sibling published packages under this
   account all carry them, and the whole point of the description and keywords is
   discoverability. Choose terms a consumer would actually search — Firebase,
   Firestore, the admin/client distinction, and the areas each package covers.

4. **Add `repository` with the package subdirectory** to each. The repository URL
   alone makes the npm page's source link point at the monorepo root; the
   subdirectory field is what makes it point at the package.

5. **Confirm the `license` field** is `MIT` on all three. This is separate from
   the `LICENSE` file in step 1 — the template repository has the field but not
   the file, which is exactly the gap being closed.

6. **Verify the tarball contents by packing, not by reading `files`.** For each
   package, produce a dry-run pack listing and check it against expectations:
   - **Present**: the built output for every declared entry point, the package's
     own `README.md` (task 3.2 writes the real ones; a placeholder is fine at
     this point), its `LICENSE`, and its `package.json`.
   - **Absent**: any `*.test.*` file, anything under `__test__/`, anything under
     `__mocks__/`, and any TypeScript source.
   - **Present, and easy to lose**: `firebase-kit-admin`'s `mocks/` build output.
     Check for it explicitly — an exclusion pattern matching on the word "mock"
     will silently drop this published entry point.

7. **Verify every declared entry point resolves inside the tarball.** For each
   subpath in each `exports` map, confirm the file it names exists in the packed
   file list. Ten entry points on `firebase-kit-admin` and seven on
   `firebase-kit-client` is enough surface that one typo is likely and would only
   surface for a consumer.

## Testing suggestions

Per the project's test exception for consumer-facing wiring, this cannot be
verified by the repository's own tests, which import source directly. Substitute
verification is the packing inspection above, plus task 3.3's full consumer
project.

- Produce a dry-run pack listing for each package and record it.
- Cross-check each listing against its `exports` map, entry by entry.
- Confirm `LICENSE` appears in all three listings.
- Confirm no test, fixture, shim, or `.ts` source file appears in any listing.

## Gotchas

- **A root `LICENSE` does not reach subpackage tarballs.** This is the specific
  reason step 1 exists, and it is easy to assume the opposite.
- **Excluding anything matching "mock" removes a public entry point.** The
  distinction is `__mocks__/` (excluded) versus `mocks/` (published).
- **Do not add `main` or `types`.** They are absent by design; adding them changes
  the resolution behavior consumers see.
- **Reading the `files` field is not verification.** Its interaction with the
  packing tool's always-include list and with negated patterns is where the
  mistakes live. Pack and look.
- **Descriptions and keywords are permanent per version.** They can be changed in
  a later release, but the `1.0.0` page is the first impression.

## Verification checklist

- [ ] Each package has its own `LICENSE` file containing the MIT text
- [ ] Each package declares a description written for npm search results
- [ ] Each package declares keywords
- [ ] Each package declares `repository` including the package subdirectory
- [ ] Each package declares `license: MIT`
- [ ] A dry-run pack listing was produced and recorded for all three packages
- [ ] Every `exports` subpath resolves to a file present in the listing — all 7
      for the client, all 10 for the admin package
- [ ] `firebase-kit-admin`'s `mocks/` build output is present in its tarball
- [ ] No `*.test.*`, `__test__/`, `__mocks__/`, or `.ts` source appears in any
      tarball
- [ ] `LICENSE` and `README.md` appear in all three tarballs
- [ ] No `main` or `types` field was added to any package
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test` all pass
- [ ] End-to-end tests: none — the project's test exception for consumer-facing
      wiring applies; substitute verification is the per-package pack listing and
      entry-point cross-check above, completed by task 3.3
