# Review

## Tasks

- 01_01 (4ae2488): `case 'test'` in `packages/firebase-kit-admin/src/validation/internal/validateSchema.ts` uses `error.reason` instead of `error.message`; betterbe peer + dev range `^6.1.0` in `packages/firebase-kit-admin/package.json`, `yarn.lock` resolves 6.1.0; 4 inline-snapshot regression tests in `validateSchema.test.ts` (value, nested, record key, root). Verify: `yarn test:unit`; read the snapshots for a single path per message.

## Open assumptions

- The `(error: '...')` wrapper stays; only the duplicated path goes.
- `^6.0.0` → `^6.1.0` is a narrowed floor, not a replaced range: squash commit is `fix:` with no `BREAKING CHANGE:` footer (patch release).

## Amendments

None.
