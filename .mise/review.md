# Review: update-packages

## Tasks

- 01_01 (365e73d, 494bd2a, bd2120e): commits the owner's dependency bumps unchanged and merges origin/main, keeping the owner's dependency lines with origin's 4.0.0 versions. Replaces the peers betterbe `^4.1.0` → `^6.0.0` (admin) and firebase `^12.18.0` → `^13.0.0` (client). Verify: `git diff origin/main...HEAD -- '*package.json'`, then `yarn lint && yarn build && yarn test` (all passed before and after the peer edit). `yarn pack` consumer check: the admin betterbe snippet compiles and trims, the packed client peer is `^13.0.0`, and the client firebase snippets compile.

## Open assumptions

- The scdate-testing peer mismatch (`vitest ^4` vs 5.0.3) was there before this branch and is out of scope.
- The READMEs are unchanged.
- The release needs a `BREAKING CHANGE:` footer in the squashed commit, because `!` alone publishes as a patch under the angular preset. It will publish v5.0.0.
- firebase 13's own `.d.ts` files reference `Temporal`. Consumers with `lib: ["ES2022","DOM"]` and `skipLibCheck: false` get tsc errors inside firebase's types, not in this package. The README is unchanged.
- CLAUDE.md's Releasing section says "`!` … or `BREAKING CHANGE:`". The critic found `!` alone doesn't produce a major. It is not edited here.

## Amendments

None.
