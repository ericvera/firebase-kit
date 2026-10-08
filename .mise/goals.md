Is the following actually an issue?
---

In firebase-kit-admin's src/validation/internal/validateSchema.ts, the test case does this:


case 'test':
  message = `${subject} failed custom validation (error: '${error.message}').`;
subject is already Value of '<path>'. In betterbe 6, error.message also starts with the path (<path>: <reason>), so the path appears twice:


Value of 'phone' failed custom validation (error: 'phone: invalid phone number').
The fix is to use only the reason part of betterbe's message, without the path in front. Either use a field from betterbe that holds just the reason, if ValidationError has one, or strip the <pathString>:  prefix from error.message.

## Investigation

Confirmed bug, reproduced against installed betterbe 6.0.0 (`message` / `pathString` / `context`):
- top-level `phone`: `phone: invalid phone number` / `phone` / `value` → `Value of 'phone' failed custom validation (error: 'phone: invalid phone number').`
- nested: `a.b: bad` / `a.b`
- record key test: `key m.k: badkey` / `m.k` / `key`
- root object test: `rootbad` / `` (empty) — no prefix.

Root cause: `packages/firebase-kit-admin/src/validation/internal/validateSchema.ts:75` embeds `error.message` inside `subject`, which (lines 29-36) already names the path. betterbe stores `formatMessage(options)` as the message (`node_modules/betterbe/dist/ValidationError.js:37`); prefix is `<joined>: ` for value context, `key <joined>: ` for key context, empty when the path is empty (lines 6-15).

No reason-only field: `ValidationError` has only `path`, `key`, `value`, `context`, `constraint`, `code`, `pathString` (`ValidationError.d.ts:62-88`); the `test` constraint is `{code:'test', data?}` with no message. So the fix strips the prefix from `error.message`. Key context occurs (record keys validated with context `'key'`, `record.js:53`; test `report` passes `effectiveContext` through), so the prefix to strip is `${context === 'key' ? 'key ' : ''}${pathString}: `, and nothing when `pathString` is `''`.

Touched: only the `case 'test'` branch at `validateSchema.ts:74-76`; `pathString` (line 27) and `context` (line 30) already in scope. Only public caller: `validateSchemaAndTrim` (`src/validation/validateSchemaAndTrim.ts:37`). Nothing else in `packages/` or READMEs uses the "custom validation" text.

Hard to undo: nothing. The thrown message text changes → `fix:` commit, patch release.

## Repro

1. Call `validateSchemaAndTrim` with a betterbe 6 schema whose field `phone` has a `.test(...)` that fails with reason `invalid phone number`.
2. Observe: `Value of 'phone' failed custom validation (error: 'phone: invalid phone number').`

## Upstream

betterbe 6.1.0 (`ericvera/betterbe` b8b8282, "feat: add reason to ValidationError") adds a read-only `reason` to `ValidationError`: the message without the `[key ]<pathString>: ` prefix, for every error code; `message` unchanged; `reason === message` when there is no prefix.

## Expected behavior

`Value of 'phone' failed custom validation (error: 'invalid phone number').` — likewise for nested paths (`a.b`) and record keys (`key m.k: ` stripped). A root-level test message (no prefix) is unchanged.

## Regression test

New `it(...)` cases in `packages/firebase-kit-admin/src/validation/internal/validateSchema.test.ts` (unit, `yarn test:unit`), using its `rejects.toThrowErrorMatchingInlineSnapshot` pattern: value path, nested path, record-key path, root-level test.

## Assumptions

- Keep the existing `(error: '...')` wrapper; only the duplicated path goes.
- Use `error.reason` instead of stripping a prefix from `error.message` (owner chose the upstream field).
- Raise betterbe in `packages/firebase-kit-admin/package.json` to `^6.1.0` in both `peerDependencies` and `devDependencies` (and the lockfile). A narrowed floor within the same major is not a replaced range, so it ships as a `fix:` patch with no `BREAKING CHANGE:` footer.

## Proposal

Issue: betterbe 6 prefixes `test` failure messages with the path, so `validateSchema` prints the path twice (`Value of 'phone' … (error: 'phone: invalid phone number')`).
Fix: use betterbe 6.1.0's `error.reason` in the `case 'test'` branch, raise firebase-kit-admin's betterbe peer and dev ranges to `^6.1.0`, and add unit regression tests (value, nested, record-key, root); ship as `fix:` (patch).
Skips: spec and critic (one branch in one module plus a range bump, nothing hard to undo).
