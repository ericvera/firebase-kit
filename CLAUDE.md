# firebase-kit

Monorepo for the published `firebase-kit-*` packages.

Never open a pull request for, or merge into another branch, any branch whose tree contains `.mise/` — that work is still in flight; run `/mise:next` on that branch to finish acceptance and cleanup first.

## Releasing

`.github/workflows/publish.yml` computes the version with
`conventional-changelog` **from commit footers only**, and merges are squashed —
so the single squashed commit message decides the release. A breaking change
(replaced peer range, removed or renamed `exports` subpath, dropped peer) must
carry `!` after the type or a `BREAKING CHANGE:` body, or it publishes as a
minor. All three packages are versioned together by
`yarn workspaces foreach --all version`, so every package takes the same major.

## Documentation conventions

- READMEs never restate a dependency's version range. `peerDependencies` is the
  only copy anything enforces; point readers at
  `npm info <pkg> peerDependencies` instead.
- Every install command block in a README shows the npm form and the yarn form
  (`# or`), and the surrounding prose stays package-manager neutral.

## Test file conventions

- In a test file, `vi.mock` calls sit directly below the imports, with
  `vi.hoisted` state above them and every other declaration below.
