# Maintainer guide

Everything in this document requires a human with npm and GitHub credentials.
Nothing here is automated, and nothing here should be automated.

Two procedures live here:

- [Bootstrap](#bootstrap-one-time) — done once, right after the repository's
  first push to `main`, before any real release is possible.
- [Recovering a partially published release](#recovering-a-partially-published-release)
  — done only if a release publishes some packages but not others.

A short [reference on how a release works](#how-a-release-works) sits between
them, because both procedures depend on it.

**One rule applies everywhere in this document: never publish these packages
with `npm publish`.** Always use Yarn's publisher (`yarn npm publish`). Only
Yarn's packer rewrites the `workspace:` protocol into a concrete version, so an
npm-packed tarball of `firebase-kit-client` or `firebase-kit-admin` is
uninstallable — and it cannot be fixed afterwards, because npm never allows
republishing a version. Reading the registry with `npm view` is fine; only
publishing is restricted.

## Bootstrap (one time)

npm cannot configure a trusted publisher for a package that does not exist yet —
the setting lives on an existing package's settings page. So each of the three
names must be published once, by hand, before the automated pipeline can ever
publish it. That is what the `0.0.1` placeholders in `packages/` are for: no
code, no dependencies, no entry points, just a `package.json` and a `README.md`.

Before starting, confirm:

- The repository exists at `ericvera/firebase-kit`, `main` is pushed, and the
  workflow run for that push was **green**.
- The `v0.0.1` tag exists on the remote (`git ls-remote --tags origin`). The
  release tooling derives the previous version from git tags; without this tag
  the first real release aborts.
- Your npm account can publish new public packages.

### 1. Create a temporary npm token

On npmjs.com → your avatar → **Access Tokens** → **Generate New Token**:

- A **Classic → Automation** token is the simplest choice: it can create new
  packages and it does not prompt for a one-time password.
- A **Granular Access Token** also works, but it must be scoped to **All
  packages** with **Read and write** permission. The three packages do not exist
  yet, so they cannot be selected individually.

This token is temporary — step 4 revokes it. The repository itself never stores
an npm token; the pipeline authenticates through OIDC trusted publishing.

### 2. Publish the three placeholders

From a clean checkout of `main` at the `v0.0.1` commit:

```sh
git switch main
git pull
yarn install --immutable
```

Supply the token to Yarn through its `YARN_NPM_AUTH_TOKEN` environment variable.
This keeps the token out of shell history and out of every file in the
repository. The prompt below works in both `bash` and `zsh`:

```sh
printf 'npm token: '
read -rs YARN_NPM_AUTH_TOKEN
export YARN_NPM_AUTH_TOKEN
echo
```

Now publish, **in exactly this order**:

```sh
yarn workspace firebase-kit-protocol npm publish --access public
yarn workspace firebase-kit-client npm publish --access public
yarn workspace firebase-kit-admin npm publish --access public
```

`firebase-kit-protocol` goes first for the same reason the release pipeline
publishes it first: both other packages depend on it, and publishing a dependent
before its dependency puts a package on the registry that references a protocol
version nobody can install. The placeholders declare no dependencies, so the
order does not strictly matter yet — follow it anyway, so the habit is right when
it does.

Notes:

- Do **not** pass `--provenance` here. Provenance requires a CI identity; the
  release workflow attaches it, a laptop cannot.
- If npm asks for a one-time password (a non-automation token with 2FA), append
  `--otp <code>` to each command.
- Yarn publishes through `https://registry.yarnpkg.com`, npm's proxy, which is
  also what the release workflow uses. In the unlikely event that the token is
  rejected there, prefix the command with
  `YARN_NPM_PUBLISH_REGISTRY=https://registry.npmjs.org` to publish to npm
  directly.

Drop the token from your shell as soon as the three publishes succeed:

```sh
unset YARN_NPM_AUTH_TOKEN
```

Verify all three landed:

```sh
for p in firebase-kit-protocol firebase-kit-client firebase-kit-admin; do
  echo "$p: $(npm view "$p" version)"
done
```

Each should print `0.0.1`.

### 3. Configure the trusted publisher for each package

Repeat for **all three** packages. On npmjs.com, open
`https://www.npmjs.com/package/<name>/access` and, under **Trusted Publisher**,
choose **GitHub Actions** and enter:

| Field                | Value          |
| -------------------- | -------------- |
| Organization or user | `ericvera`     |
| Repository           | `firebase-kit` |
| Workflow filename    | `publish.yml`  |
| Environment          | _leave empty_  |

Save each one. The workflow declares no GitHub environment, so setting one here
would make every publish fail authentication.

`publish.yml` is registered by filename. **Renaming `.github/workflows/publish.yml`
breaks publishing** with an authentication error that does not point back at the
rename. If it ever must be renamed, update all three trusted publishers first.

### 4. Revoke the temporary token

Back on npmjs.com → **Access Tokens** → delete the token from step 1. From this
point on, every publish goes through the workflow's OIDC token exchange, and no
long-lived credential exists anywhere.

### 5. Enable "Allow auto-merge"

GitHub → repository → **Settings** → **General** → **Pull Requests** → check
**Allow auto-merge**.

The dependency-update workflow marks passing non-major dependabot pull requests
for auto-merge. Without this setting that step fails and every dependabot pull
request sits open until someone merges it by hand.

### 6. Make sure `main`'s protection permits the release push

The release workflow commits the version bump (`chore(release): vX.Y.Z [skip ci]`)
back to `main` and pushes it with the built-in `GITHUB_TOKEN` **before** it
publishes anything. If branch protection rejects that push, every release fails
before it publishes — the failure looks like a git error, not a policy problem.

Either leave `main` unprotected, or, if you protect it:

- **Rulesets**: add the repository's GitHub Actions to the ruleset's **Bypass
  list**.
- **Classic branch protection**: the "Require a pull request before merging" and
  "Require status checks" rules both block this push. Add `github-actions[bot]`
  to the allowed-to-bypass actors, or leave those rules off.

### 7. Confirm and hand back

Bootstrap is complete when all of the following are true:

- [ ] `firebase-kit-protocol`, `firebase-kit-client`, and `firebase-kit-admin`
      all exist on npm at `0.0.1`
- [ ] All three have a trusted publisher pointing at `ericvera/firebase-kit` and
      `publish.yml`
- [ ] The temporary npm token is revoked
- [ ] "Allow auto-merge" is enabled
- [ ] `main`'s protection permits the release workflow's version-bump push

Development of the real packages resumes only after this list is complete. The
first real release must be exactly `1.0.0`; the workflow enforces that and aborts
otherwise.

## How a release works

Every push to `main` runs `.github/workflows/publish.yml`, which:

1. Installs, builds, lints, and tests, then fails if `.mise/` is tracked.
2. Computes the next version with conventional commits. **The previous version
   comes from the newest `v*` git tag, not from `package.json`.**
3. Aborts if this is the first release and the computed version is not `1.0.0`.
4. Commits and pushes `chore(release): vX.Y.Z [skip ci]` to `main`.
5. Publishes `firebase-kit-protocol`, then `firebase-kit-client`, then
   `firebase-kit-admin`, each with `yarn npm publish --provenance`.
6. **Last**, creates the `vX.Y.Z` tag and the GitHub release.

Two consequences matter for recovery: the tag existing means the entire release
landed, and a push carrying no release-worthy commits does nothing at all. There
is deliberately no manual trigger — npm cannot republish a version, so a re-run
could never complete a failed release.

## Recovering a partially published release

The failure this covers: the workflow run is red on one of the publish steps, so
some packages are on npm at the new version and others are not.

**Do not re-run the workflow, and do not push a "retry" commit yet.** Work
through the steps below first.

### 1. Find the attempted version

It is in the version-bump commit on `main`. It is **not** in a tag — tagging
happens only after all three packages publish, so a partial failure leaves no tag
at all.

```sh
git switch main
git pull
git log -1 --grep='^chore(release):' --format='%H %s'
```

The subject reads `chore(release): v1.2.0 [skip ci]`. Keep both the commit SHA
and the version:

```sh
VERSION=1.2.0
BUMP_SHA=<the sha printed above>
```

### 2. Find out which packages published

```sh
for p in firebase-kit-protocol firebase-kit-client firebase-kit-admin; do
  if npm view "$p@$VERSION" version >/dev/null 2>&1; then
    echo "$p: published"
  else
    echo "$p: MISSING"
  fi
done
```

### 3. Pick a route

Both routes end with a `v$VERSION` tag on the bump commit. That tag is what the
next release's version computation reads; leaving it off means the next release
recomputes `$VERSION` and fails again on the packages that already have it.

#### Route A — finish this version by hand

Use this when the missing packages can still be published exactly as the workflow
would have.

Build the tree at the bump commit, then publish the **missing** packages only, in
dependency order (protocol → client → admin), using the same token procedure as
[bootstrap step 2](#2-publish-the-three-placeholders):

```sh
git fetch origin
git switch --detach "$BUMP_SHA"   # exactly the tree CI tried to publish
yarn install --immutable
yarn build

printf 'npm token: '
read -rs YARN_NPM_AUTH_TOKEN
export YARN_NPM_AUTH_TOKEN
echo

# Only the packages reported MISSING above, in this order:
yarn workspace firebase-kit-protocol npm publish --access public
yarn workspace firebase-kit-client npm publish --access public
yarn workspace firebase-kit-admin npm publish --access public

unset YARN_NPM_AUTH_TOKEN
```

If npm rejects the token because the package requires a trusted publisher,
temporarily relax that requirement on the package's settings page and restore it
immediately afterwards. Manually published versions carry no provenance
attestation; that is unavoidable off CI and is the main cost of this route.

Then create the tag and the release the workflow never got to:

```sh
git tag "v$VERSION" "$BUMP_SHA"
git push origin "v$VERSION"
gh release create "v$VERSION" --title "v$VERSION" \
  --notes "Release completed manually after a partial publish failure."
```

Revoke the temporary token afterwards, exactly as in
[bootstrap step 4](#4-revoke-the-temporary-token).

#### Route B — abandon this version

Use this when publishing by hand is not appropriate — for example the failure
revealed a real problem with the build, or the missing tarball would differ from
what CI produced.

Leave the packages that published where they are. Do not publish the missing ones
at `$VERSION`. Tag the bump commit anyway, so the next release moves past this
version:

```sh
git tag "v$VERSION" "$BUMP_SHA"
git push origin "v$VERSION"
```

Pushing a tag does not trigger any workflow — the release workflow only runs on
pushes to `main`.

Then fix whatever failed and push a normal release-worthy commit. The next run
computes a version above `$VERSION` and publishes all three there, putting the
packages back in step.

The result is that the packages which missed `$VERSION` simply never had it.
**That gap is acceptable.** The pipeline keeps the three packages on the same
version going forward; it does not promise a gapless history for any one of them.

### Facts that constrain both routes

- **Republishing is impossible.** npm rejects a publish for a version that
  already exists, and unpublishing does not free the version for reuse. A bad
  publish is never fixed in place — it is superseded by a new version.
- **Never delete the `v0.0.1` tag.** It is the bootstrap seed the first real
  release's version computation reads, and the guard that forces the first
  release to be `1.0.0` keys off it. It is unrelated to any recovery tag created
  above.
- **Never weaken a guard to get a release through.** The `.mise/` check and the
  `1.0.0` check exist because the states they block are permanent once published.
