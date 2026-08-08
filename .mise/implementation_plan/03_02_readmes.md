# Task 3.2: Root and per-package READMEs

## Goal

Write the root README and one README per package. These are the npm package
pages — for three packages that have never had any documentation at all.

## Requirements addressed

REQ-DOC-1, REQ-DOC-2, REQ-DOC-3, REQ-DOC-4, REQ-DOC-5

## Background

**Work on the mise feature branch.** Tasks 2.1–2.4 landed all three packages;
task 3.1 gave them publication metadata and verified their tarball shape.

**None of the three packages has a README today** — this is net-new authoring
across roughly 13k LOC and 18 published entry points, not a port. It is the
largest writing task in the plan.

The template repository's per-package READMEs follow a consistent skeleton:
`# name` → `## Overview` → `## Features` → `## Installation` → `## Requirements`
→ usage → API reference → `## License`. Its root README is short: title, one-line
tagline, `## Packages` with a bulleted link and one-line description per package,
`## Features`, `## Requirements`, `## License`.

Published entry points to document:
- `firebase-kit-protocol` — one entry point: shared types and constants
- `firebase-kit-client` (7) — `.`, `./callable`, `./connectivity`, `./firestore`,
  `./rate-limit`, `./runtime`, `./testing`
- `firebase-kit-admin` (10) — `.`, `./auth`, `./callable`, `./errors`,
  `./firestore`, `./mocks`, `./runtime`, `./tasks`, `./testing`, `./validation`

Peer dependencies a consumer must install alongside, which the READMEs must state
because npm will not install them automatically:
- `firebase-kit-client`: `firebase`, and **`getsetdel` at major 2** — note this
  explicitly. `getsetdel` is published at 3.0.0, so a consumer already on v3 will
  hit a peer-resolution conflict. That range is a deliberate decision recorded in
  the requirements; the README's job is to make sure it is not a surprise.
  `vitest` is an optional peer, needed only for `./testing`.
- `firebase-kit-admin`: `firebase-admin`, `firebase-functions`, and **`betterbe`**
  (task 2.4 made it a required peer because `./validation` imports it at runtime).
  `firestore-snapshot-utils` and `vitest` are optional peers, needed only for
  `./testing` and `./mocks`.

Task 3.3 will verify every code block in these files against the real published
surface, so accuracy here is checked, not assumed.

## Files to modify/create

- `README.md` — root, replacing the task 1.1 placeholder
- `packages/firebase-kit-protocol/README.md` — replacing the placeholder
- `packages/firebase-kit-client/README.md` — replacing the placeholder
- `packages/firebase-kit-admin/README.md` — replacing the placeholder

## Implementation details

1. **Root README.** Follow the template's shape: what the monorepo is, a
   `## Packages` section linking to each package directory with a one-line
   description, requirements (Node >= 24), and the license. Keep the link to
   `MAINTAINERS.md` that task 1.3 added.

2. **Per-package READMEs.** For each, cover:
   - **Overview** — what the package is for, in a couple of sentences.
   - **Installation** — the install command, followed immediately by the peer
     dependencies the consumer must install themselves, distinguishing required
     from optional and saying what each optional one unlocks.
   - **Requirements** — Node >= 24, ESM only.
   - **Entry points** — every published subpath, each with a one-line statement
     of what it provides. This is the part a consumer scans first, and with 7 and
     10 subpaths it needs to be a list, not prose.
   - **Usage** — at least one worked example per package. Prefer one example per
     entry point where the entry point's purpose is not obvious from its name.
   - **License.**

3. **Derive every example from the real exported API.** Read the source for each
   entry point and use the actual exported names and signatures. Do not
   reconstruct an API from the directory name or from what seems reasonable —
   these packages have never been documented, so there is no prior text to
   inherit an error from, and equally no safety net.

4. **Give every runnable code block a file-path header comment** naming the file
   it represents. Task 3.3 extracts these blocks to those paths and runs or
   type-checks them verbatim; a block without a path cannot be verified.

5. **Call out the `getsetdel` major explicitly** in the `firebase-kit-client`
   README, in the installation section rather than a footnote. A consumer on
   `getsetdel` 3 will get a resolution error, and the README is the only place
   that explains why.

6. **Note which examples cannot run standalone.** `firebase-kit-admin`'s entry
   points generally need a live emulator and an initialized admin app;
   `firebase-kit-client`'s need an IndexedDB implementation. Where an example
   depends on that setup, say so in the surrounding prose so a consumer copying
   it knows what else they need. Task 3.3 type-checks rather than executes these.

## Testing suggestions

Per the project's test exception for consumer-facing wiring, the repository's own
tests import source directly and cannot exercise documentation. Verification is
task 3.3, which packs the tree and runs or type-checks each block against the
real published packages.

Before handing off to that task:

- Re-read each example against the source it documents, checking exported names
  and argument shapes by eye.
- Confirm every runnable block carries a file-path header comment.
- Confirm every published entry point is mentioned in its package's README — 7
  for the client, 10 for the admin package.
- Confirm every required and optional peer is listed with its role.

## Gotchas

- **These examples are unverified until task 3.3 runs.** Writing them from
  plausible-looking API shapes is the failure mode; the entry-point count is
  large enough that guessing will not survive.
- **A block without a path header cannot be verified** and will be silently
  skipped by the next task.
- **`./mocks` and `./testing` are published API on `firebase-kit-admin`** and
  deserve documentation, even though they exist to support a consumer's tests.
  They are also where the optional peers matter.
- **Do not document `src/internal/`.** It is deliberately not exported.
- **Peer dependencies are the most common install-time failure** for packages
  like these, and are invisible in the usage examples. The installation section
  carries the weight.

## Verification checklist

- [ ] Root README states the monorepo's purpose, links every package, and links
      `MAINTAINERS.md`
- [ ] Each package has a README covering overview, installation, requirements,
      entry points, usage, and license
- [ ] Every published entry point is documented — 1 for protocol, 7 for the
      client, 10 for the admin package
- [ ] Required and optional peer dependencies are listed for each package, with
      what each optional one unlocks
- [ ] The `firebase-kit-client` README states the required `getsetdel` major and
      why a consumer on the newer major will see a conflict
- [ ] The `firebase-kit-admin` README lists `betterbe` as a required peer
- [ ] Every runnable code block carries a file-path header comment
- [ ] Every example uses real exported names and signatures, checked against source
- [ ] Examples needing an emulator or an IndexedDB implementation say so
- [ ] `yarn format`, `yarn lint`, `yarn build`, `yarn test` all pass
- [ ] End-to-end tests: none — the project's test exception for consumer-facing
      wiring applies; substitute verification is task 3.3's packed-consumer run,
      which this task must leave in a verifiable state (path headers present,
      entry points covered)
