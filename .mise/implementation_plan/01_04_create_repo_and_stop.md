# Task 1.4: Create the GitHub repository, push `main`, and hand off

## Goal

Create the public GitHub repository, push the phase-1 skeleton to `main` in a way
that runs the release workflow without publishing anything, rebase the feature
branch onto the new `main`, and then **stop** and hand off to the maintainer.

## Requirements addressed

REQ-REPO-5, REQ-BOOT-4, REQ-BOOT-5, REQ-BOOT-6, REQ-PUB-2

## Background

Tasks 1.1–1.3 built, on `main`, a complete Yarn 4 monorepo skeleton: root
toolchain and quality commands, the release and dependency workflows, three
source-free placeholder packages at `0.0.1`, and `MAINTAINERS.md`. All quality
commands pass. Nothing has been pushed anywhere and no GitHub repository exists
yet.

The mise feature branch (`feat/publish-firebase-kit-packages`) carries the
`.mise/` planning directory and branched off `main` before any of this existed.

This task is the boundary of what can be done without the maintainer: npm's
trusted publisher configuration requires each package to already exist on the
registry, and publishing the placeholders needs a credential this work does not
have and must not have.

## Files to modify/create

No files change. This task creates a remote repository and pushes existing
commits.

## Implementation details

1. **Check the commit subject before pushing.** The commit (or commits) being
   pushed to `main` must carry a **non-release-worthy** conventional subject — a
   `chore:` subject is the intended form. This is the mechanism, not a
   convenience: `publish.yml` runs on this push, and the changelog step must
   report that it skipped so that every publish step is bypassed. Trusted
   publishing is not configured yet, so a publish attempt would fail the run.

   Do **not** achieve this by removing, renaming, or disabling the workflow — the
   workflow filename is what the maintainer is about to register with npm, and
   the run is also the only rehearsal the pipeline gets before the release that
   matters.

2. **Verify `.mise/` is not on `main`.** `main` must contain `CLAUDE.md`,
   `.claude/mise-config.md`, and everything tasks 1.1–1.3 added — and no `.mise/`
   directory. The guard step added in task 1.2 will fail the run otherwise. This
   is the whole reason phase 1 was authored on `main` rather than merged in.

3. **Create the repository.** Public, named `firebase-kit`, under the `ericvera`
   account. Creating it is part of this work. Set a description and, if
   convenient, the topics; neither is required.

   Do not enable branch protection that would block the release workflow's own
   version-bump push — `MAINTAINERS.md` covers this, and the maintainer owns the
   decision, but do not create the problem here.

4. **Push `main`.**

5. **Watch the workflow run and confirm it is green.** Expected behavior: install,
   build, lint, and test all pass on the source-free skeleton; the `.mise/` guard
   passes; the changelog step reports a skip; every step after it is bypassed;
   the run ends successfully having published nothing, created no tag, and made
   no release.

   This is a **partial** rehearsal. It proves the workflow parses, that the
   toolchain installs, and that the gates run on a runner. It does **not**
   exercise the emulator path — there are no tests yet — and it does not exercise
   any publish step.

   If the run is red, fix it here. A red phase-1 run means the maintainer would
   be configuring trusted publishing against a pipeline that does not work.

6. **Rebase the mise feature branch onto the new `main`** so phase 2 builds on
   the skeleton rather than on the empty repository. Confirm the branch still
   carries `.mise/` and that `main` still does not.

7. **STOP. Hand off to the maintainer.** Report:
   - The repository URL and a link to the green workflow run.
   - That `MAINTAINERS.md` contains the bootstrap procedure, and summarize its
     steps: publish the three placeholders with Yarn's publisher using a
     temporary token, **`firebase-kit-protocol` first**; configure the trusted
     publisher for each package on npmjs.com against repository
     `ericvera/firebase-kit` and workflow file `publish.yml`; revoke the token;
     enable "Allow auto-merge".
   - That phase 2 must not begin until they confirm all three placeholders are
     published and all three trusted publishers are configured.

   **Do not publish anything.** Do not proceed to task 2.1 on any inferred
   signal — only an explicit confirmation from the maintainer resumes the work.
   Resuming early would push a release that cannot authenticate.

## Testing suggestions

Per the project's test exception for consumer-facing wiring, the release pipeline
is not exercisable by the repository's own tests. The substitute verification for
this task is the live workflow run itself:

- Confirm the run is green and that its log shows the changelog step skipping and
  the publish steps bypassed.
- Confirm on npmjs.com that none of the three names exists yet — the run must not
  have published anything.
- Confirm no tag and no GitHub release were created.

## Gotchas

- **A release-worthy commit subject here would try to publish.** A `feat:` or
  `fix:` subject makes the changelog step compute a version, and the run then
  attempts to publish against unconfigured OIDC. Check the subject before pushing,
  not after.
- **Squashing the phase-1 commits changes the subject.** If the push is squashed,
  the resulting subject is what the changelog step reads.
- **`.mise/` reaching `main` fails the run by design.** If the guard trips, the
  fix is to get `.mise/` off `main` — never to weaken the guard.
- **The rebase in step 6 is easy to forget**, and skipping it means phase 2
  starts from a branch with no skeleton, producing conflicts that look like
  something worse than they are.
- **This is a hard stop, not a checkpoint.** Everything downstream depends on
  registry state that only the maintainer can create.

## Verification checklist

- [ ] `main` contains the full phase-1 skeleton and no `.mise/` directory
- [ ] The commit subject pushed to `main` is non-release-worthy
- [ ] The public repository `ericvera/firebase-kit` exists
- [ ] The workflow run on the push is **green**
- [ ] The run log shows the changelog step skipping and all publish steps bypassed
- [ ] No package exists on npmjs.com; no tag and no GitHub release were created
- [ ] The mise feature branch is rebased onto the new `main` and still carries
      `.mise/`
- [ ] The maintainer has been given the repository URL, the run link, and the
      bootstrap summary — and the work has stopped
- [ ] End-to-end tests: none — the project's test exception for consumer-facing
      wiring applies; substitute verification is the live green workflow run and
      the registry/tag checks above
