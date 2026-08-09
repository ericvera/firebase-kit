# Task 1.2: Release workflow, dependency automation, and guards

## Goal

Add the GitHub Actions configuration that publishes all three packages to npm on
every push to `main`, plus the automated dependency updates and the two guards
that protect a release.

## Requirements addressed

REQ-PUB-1, REQ-PUB-2, REQ-PUB-3, REQ-PUB-4, REQ-PUB-5, REQ-PUB-6, REQ-PUB-7,
REQ-PUB-8, REQ-PUB-9, REQ-PUB-10, REQ-VER-3, REQ-VER-5a, REQ-VER-6, REQ-VER-6a,
REQ-VER-7, REQ-DEP-1, REQ-DEP-2, REQ-DEP-3, REQ-DEP-4, REQ-GUARD-1, REQ-GUARD-2,
REQ-GUARD-3, REQ-TEST-5, REQ-BOOT-8

## Background

This repository publishes three npm packages — `firebase-kit-protocol`,
`firebase-kit-client`, `firebase-kit-admin` — in lockstep: one shared version,
one tag per release, all three published every time.

Task 1.1 created the root skeleton on `main`: a private
`@firebase-kit/monorepo` package at version `0.0.1` with `yarn format`,
`yarn lint`, `yarn build`, `yarn test`, `yarn test:unit`, and `yarn test:emulator`
scripts, Yarn 4.18.0 committed under `.yarn/releases/`, and a committed
`yarn.lock`. No package source exists yet — `packages/` is empty until task 2.1.

The template is `/Users/eric/Code/scdate/.github/`, which does exactly this for
three packages. Read those three files first. This task copies their mechanics
and deviates in five specific places, each called out below.

**Continue working directly on `main`.**

## Files to modify/create

- `.github/workflows/publish.yml` — the release pipeline. **The filename is
  fixed**: the maintainer will register it with npm as the trusted publisher, and
  renaming it afterwards silently breaks every release.
- `.github/workflows/dependabot.yml` — auto-merge for dependency PRs
- `.github/dependabot.yml` — update schedule and grouping
- `.github/actions/setup-firebase-tools/action.yml` — Java + emulator cache

## Implementation details

1. **Port the emulator setup action.** Copy
   `/Users/eric/Code/okven/.github/actions/setup-firebase-tools/action.yml`
   verbatim. It does three things: installs Java 21 (temurin), resolves the
   `firebase-tools` version by querying the dependency graph and writing it to
   the step output, and caches `~/.cache/firebase/emulators` keyed on the runner
   OS and that version.

   This is needed from phase 1 onward even though nothing uses the emulator yet,
   because the resolve step fails when nothing in the workspace declares
   `firebase-tools` — see step 6.

2. **`publish.yml` — trigger and concurrency.** Trigger on push to `main` only.
   There must be **no manual trigger**: a re-run cannot complete a partial
   release (npm forbids republishing), and because the version bump is already on
   `main` a re-run would compute a *new* version rather than retry the failed one.

   Serialize runs by branch, but set **`cancel-in-progress: false`**. scdate sets
   it to `true`; that is the first deliberate deviation. Cancelling a run
   mid-publish would leave some packages published at a version and others not.

3. **`publish.yml` — permissions.** `contents: write` so the workflow can push
   its own version-bump commit, and `id-token: write` so Yarn can perform the
   npm OIDC token exchange. **No npm token secret is used or referenced
   anywhere.**

4. **`publish.yml` — checkout and setup.** Checkout with full history
   (`fetch-depth: 0`) — the changelog step needs tags to determine the previous
   release. Set up Node 24 with the npm registry configured.

5. **`publish.yml` — install and gates, in this order:** install with the
   immutable-lockfile flag passed **explicitly** (scdate runs a bare `yarn` and
   relies on Yarn's CI default; that is the second deliberate deviation), then
   `yarn build`, then `yarn lint`, then `yarn test`.

   Build must precede lint because the typed lint rules resolve types across
   project references. Note scdate's *dependabot* workflow gets this order wrong
   — do not copy that ordering into either workflow here.

   These gates run on **every** push to `main`, including pushes that produce no
   release. This is the repository's only CI, so a non-releasing push would
   otherwise be unchecked.

6. **`publish.yml` — emulator toolchain.** Use the composite action from step 1
   before the test step, so `yarn test` can run the emulator suite once task 2.3
   adds it.

7. **`publish.yml` — the `.mise/` guard.** Add a step that fails the run if any
   `.mise/` path is tracked in git, emitting a GitHub error annotation. Position
   it **after** build/lint/test and **before** the changelog step. That position
   is required: a guard trip must still report the state of the code, but must
   prevent any version bump, publish, tag, or release. It must also fail a push
   that carries `.mise/` even when that push contains no release-worthy commits.

8. **`publish.yml` — compute the version.** Use
   `TriPSs/conventional-changelog-action@v6` configured so it only *computes*:
   changelog file output off, and commit, tag, and push all disabled. Every step
   after this one is conditional on the action reporting that it did **not** skip,
   so a push with no release-worthy commits ends green having published nothing
   and tagged nothing.

   **Know where the previous version comes from.** Because this configuration
   disables the action's own release commit, the action does *not* read
   `package.json` — it derives the previous version from the newest matching
   **git tag** (default prefix `v`), and reports none when no tag exists. Its
   `fallback-version` input has no default, so with no tags it produces a
   hardcoded `0.1.0` regardless of commit footers. This is why task 1.4 seeds a
   `v0.0.1` tag, and why the checkout in step 4 fetches full history: without
   tags the version computation is meaningless.

   Do **not** set `fallback-version`. It would paper over a genuinely missing tag
   on some later release rather than failing visibly.

   No `CHANGELOG.md` is committed — changelog content lives in the GitHub release
   notes.

9. **`publish.yml` — the `1.0.0` guard.** Immediately after the changelog step
   and **before** the version-bump commit, add a step that aborts the run if:
   a version was computed (the changelog step did not skip), **and** the current
   version is the `0.0.1` bootstrap placeholder, **and** the computed version is
   not exactly `1.0.0`.

   All three conditions matter. Without the "a version was computed" clause the
   guard also fires on the phase-1 push and on every non-releasing push before
   the first release, where no version exists and the run is required to pass.
   Placing it before the bump commit matters too — aborting afterwards would
   leave a wrong version committed on `main` as the base for the next
   computation. A wrong version published once is permanent.

10. **`publish.yml` — apply the version.** Set the version across the root and
    every workspace using Yarn's deferred version mechanism followed by an apply
    step, then commit and push with `stefanzweifel/git-auto-commit-action`,
    message `chore(release): v<version> [skip ci]`. The `[skip ci]` marker keeps
    that commit from triggering another run.

11. **`publish.yml` — publish, in dependency order.** One step per package, each
    running from that package's directory, using **`yarn npm publish --access
    public`** — never `npm publish`. Yarn's packer rewrites the `workspace:`
    protocol to a concrete version; npm's does not, so an npm-packed dependent
    would ship a literal `workspace:*` range and be uninstallable.

    Order is `firebase-kit-protocol`, then `firebase-kit-client`, then
    `firebase-kit-admin`. Both dependents pin protocol exactly, so publishing a
    dependent first puts a package on the registry referencing a protocol version
    nobody can install.

    Enable **provenance explicitly** — scdate has none anywhere, and Yarn does
    not enable it by default the way the npm CLI does. That is the third
    deliberate deviation. Do not add the `npm install -g npm@…` step scdate
    carries; Yarn performs the OIDC exchange itself and that step is vestigial
    here.

12. **`publish.yml` — tag and release last.** Create the tag and GitHub release
    with `ncipollo/release-action` **after** all three publish steps, using the
    tag value the changelog step produced so the tag format matches what the
    changelog tooling scans for on the next release (`v<version>`). Creating it
    last means a tag existing is evidence the whole release landed.

    Set the release **body to the generated changelog** the changelog step
    produced — the template does this and it is easy to drop, leaving releases
    with an empty body. The notes are the only place changelog content lives,
    since no `CHANGELOG.md` is committed.

13. **Do not weaken step failure semantics.** Each publish step must fail the run
    and prevent the following ones. GitHub Actions gives this by default, but
    only as long as the step conditions do not override it: never add
    `continue-on-error`, and never write a condition using `always()` — a
    condition like `always() && <skipped check>` would keep publishing the
    remaining packages after one failed, which is precisely the half-published
    state the recovery procedure exists to avoid.

14. **`.github/dependabot.yml`.** Copy scdate's: weekly, npm at `/` plus
    github-actions at `/`, with the `dev-non-major`, `prod-non-major`, and
    `actions-non-major` groups so non-major updates arrive grouped rather than as
    one PR per package.

15. **`.github/workflows/dependabot.yml`.** Copy scdate's auto-merge workflow,
    with three deviations. First, **exclude all major updates from auto-merge, for
    every ecosystem** — scdate excludes only github-actions majors (fourth
    deliberate deviation). Second, use the same build → lint → test order as
    `publish.yml`, and include the emulator setup action from step 1, since
    `yarn test` will run the emulator suite after task 2.3 and would otherwise
    fail for lack of a Java runtime (fifth deliberate deviation). Third, install
    with the **immutable-lockfile flag passed explicitly**, exactly as in step 5 —
    this workflow is CI too, and a dependency-update run that silently rewrites
    the lockfile defeats the point of checking it.

## Testing suggestions

Per the project's test exception for consumer-facing wiring, the publish workflow
cannot be exercised by the repository's own tests. Substitute verification:

- Lint both workflow files and the composite action with `actionlint`, or failing
  that, validate them as YAML and check every `${{ }}` expression by eye.
- Trace each conditional by hand for four scenarios and write the expected
  outcome down: (a) push with no release-worthy commits, (b) push carrying
  `.mise/`, (c) first real release computing `1.0.0`, (d) first real release
  computing something else.
- The workflow's first real execution is the phase-1 push in task 1.4, which is
  scenario (a) and must end green.

## Gotchas

- **The workflow filename is load-bearing after the stop.** npm's trusted
  publisher configuration names `publish.yml`. Renaming it later breaks
  publishing with an authentication error that does not obviously point at the
  filename.
- **`cancel-in-progress: true` is the scdate default and is wrong here.** It is
  easy to copy without noticing.
- **The changelog action's skip output drives every downstream step.** Miss the
  condition on one step and a non-releasing push will try to publish.
- **The `1.0.0` guard fires on the phase-1 push if you omit the "version was
  computed" condition.** That push must end green.
- **The version-bump commit must not retrigger the workflow.** Both `[skip ci]`
  and GitHub's own rule that a `GITHUB_TOKEN` push does not trigger workflows
  protect this; keep the marker anyway.
- **`yarn info firebase-tools` fails when nothing declares it.** The composite
  action calls it unconditionally, so the root must declare `firebase-tools`
  from phase 1 — task 1.3 adds it.

## Verification checklist

- [ ] `publish.yml` triggers only on push to `main` and defines no manual trigger
- [ ] `concurrency` sets `cancel-in-progress: false`
- [ ] Permissions are exactly `contents: write` and `id-token: write`; no npm
      token is referenced anywhere in the repository
- [ ] **Both** workflows pass the immutable-lockfile flag explicitly
- [ ] Step order in `publish.yml` is: install → build → lint → emulator setup →
      test → `.mise/` guard → changelog → `1.0.0` guard → version bump → commit →
      publish ×3 → tag/release
- [ ] The emulator setup action is referenced before the test step in **both**
      workflows
- [ ] The three publish steps run protocol, then client, then admin, each with
      `yarn npm publish --access public` and provenance enabled
- [ ] Every step after the changelog step is conditional on it not having skipped
- [ ] The `1.0.0` guard also requires that a version was computed
- [ ] `fallback-version` is **not** set on the changelog step
- [ ] The GitHub release body is the generated changelog, not empty
- [ ] No step uses `continue-on-error`, and no step condition uses `always()`
- [ ] Dependabot auto-merge excludes majors for **all** ecosystems
- [ ] The dependabot workflow provisions Java and the emulator cache
- [ ] `actionlint` (or a YAML parse plus manual expression review) is clean
- [ ] End-to-end tests: none — the project's test exception for consumer-facing
      wiring applies; substitute verification is the workflow lint plus the
      four-scenario conditional trace above, with the real first execution
      landing in task 1.4
