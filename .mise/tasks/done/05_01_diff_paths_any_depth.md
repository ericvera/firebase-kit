# 05_01 DB diff normalizes document paths at any depth

## Goal

`getDocPath` in
`packages/firebase-kit-admin/src/testing/internal/DocumentChangeSnapshot.ts`
stops throwing `Path segments longer than 4 not supported yet.` For a document
path of any even length, every ancestor document id is replaced by the content
hash of that ancestor document (the hash the single-parent case already uses),
and the last segment becomes `[ID]`. Paths with 2 or 4 segments print exactly
as they do today, so no existing snapshot changes and this is not a breaking
change. A missing ancestor still throws, and the `Document not found for path`
error now says which collection's ref or query to add to `getDBSnapshot`.

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/testing/internal/DocumentChangeSnapshot.ts` (modify)

Tests (do not count): `src/testing/internal/DocumentChangeSnapshot.test.ts`.

No README change. The admin README states neither the old depth limit nor the
ancestor requirement (checked: its testing section at `README.md:556-570` and
the API Reference at `README.md:812-817` say nothing about either), so the
amendment's condition for a README mention is not met.

## Background

- Current code in `src/testing/internal/DocumentChangeSnapshot.ts`:
  - `generateHash(data)` (`:35-41`): md5 of `JSON.stringify(data)`, base64,
    with `/ \ + =` replaced by `a`.
  - `getNormalizedIDForPath(path, docs)` (`:47-72`): finds the doc whose
    `ref.path === path` in `docs`, throws
    `` new Error(`Document not found for path: ${path}`) `` when absent
    (`:53-55`), otherwise normalizes that document's own timestamps and buffers
    and returns `generateHash(normalizedData)`.
  - `getDocPath(doc, allDocs)` (`:78-96`): splits `doc.ref.path` on `/`. For
    length 4 it hashes `segments.slice(0, 2)` (the parent document) into
    `segments[1]`. For length above 4 it throws. It then sets the last segment
    to `[ID]`.
  - `BaseDocumentSnapshot` (`:99-111`) calls `getDocPath` in its constructor,
    so every `Added/Removed/Modified/UnmodifiedDocumentSnapshot` construction
    goes through it. Callers are `src/testing/internal/getDBChanges.ts:89,102,112,119`,
    which pass the after docs (added, modified, unmodified) or the before docs
    (removed) as `allDocs`. Those docs come from `DBSnapshot.docs`, read by
    `getDBSnapshot(inputs)` (`src/testing/getDBSnapshot.ts:33`) from the refs
    or queries the test passed. The public entry points that reach this code are
    `getDBChangesDiff(before, masks?)` and `expectNoDBChanges(before)`.
- Existing tests in `src/testing/internal/DocumentChangeSnapshot.test.ts`:
  - `:113-121` top-level path prints `entries/[ID]`.
  - `:123-142` subcollection parent hash, pinned as
    `"spaces/asbh2OkU2iqwHWY9iJGtlwaa/entries/[ID]"`. This must not change.
  - `:144-158` missing parent, pinned as
    `[Error: Document not found for path: spaces/space-1]`. Its inline snapshot
    changes because the message gains the hint (edit it by hand, see Gotchas).
  - `:160-171` `throws on a path nested deeper than one subcollection`. Delete
    it, since that behavior is removed.
  - Fixture: `createDocSnapshot({ path, data, updateTimeMs? })` from
    `src/__test__/utils/createDocSnapshot.ts`, which fakes `ref.path`,
    `ref.parent.id`, `updateTime` and `data()`.
- Design decisions (amendment 2026-11-13, owner asked at review):
  - Each ancestor id is replaced by the hash of that ancestor document's own
    content, exactly as `getNormalizedIDForPath` computes it today. The hash does
    not fold in the ancestor's own ancestors. Collection-id segments (even
    indexes) are kept as is.
  - Every ancestor document must be in `allDocs`, as the one-level case already
    requires. No fallback for a missing ancestor.
  - The not-found error names the missing ancestor path, the document whose path
    was being normalized, and the collection path whose ref or query must be
    added to `getDBSnapshot`.

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. Change `getNormalizedIDForPath` to also take the path of the document being
   normalized, for example
   `getNormalizedIDForPath(path: string, childPath: string, docs: QueryDocumentSnapshot[])`.
   When the doc is missing, throw with the collection path of the missing
   ancestor (`path` without its last segment) in the hint. Suggested message,
   one line, no semicolons:

   ```
   Document not found for path: spaces/space-1 (an ancestor of spaces/space-1/entries/entry-1). Add a ref or query covering the spaces collection to getDBSnapshot, so the ancestor is in the snapshot.
   ```

   For a deeper missing ancestor such as `spaces/space-1/entries/entry-1`, the
   collection named is `spaces/space-1/entries`. Update the function's JSDoc to
   match (it currently says "parent path for a subcCollection item", fix the
   typo while there).
2. Rewrite `getDocPath`:
   - Keep the original segments in a separate array (`doc.ref.path.split('/')`)
     and build the output in a copy, so each ancestor path is built from the
     original ids and never from an already-hashed segment.
   - For every odd index `i` below `segments.length - 1`, set
     `output[i] = getNormalizedIDForPath(segments.slice(0, i + 1).join('/'), doc.ref.path, allDocs)`.
   - Set the last segment to `[ID]` and return `output.join('/')`.
   - Delete the `> 4` branch and its error.
   - Update the JSDoc: the last segment becomes `[ID]` and every ancestor
     document id becomes a hash of that ancestor's content, which must be in the
     snapshot.
3. Tests in `src/testing/internal/DocumentChangeSnapshot.test.ts` (follow the
   existing style: `it(...)` at top level, a `// Verify:` comment over the key
   assertion, inline snapshots):
   - Delete `throws on a path nested deeper than one subcollection`.
   - Hand-edit the missing-parent test's inline snapshot to the new message.
   - Add `replaces every ancestor id with a hash of that ancestor document`:
     docs `spaces/space-1` (`{ name: 'space one' }`, the same data as the
     existing parent test), `spaces/space-1/entries/entry-1`
     (`{ name: 'first' }`) and
     `spaces/space-1/entries/entry-1/comments/comment-1` (`{ text: 'hi' }`).
     Assert the comment's `normalizedPath` with `toMatchInlineSnapshot`. Its
     second segment must equal `asbh2OkU2iqwHWY9iJGtlwaa` (same parent data as
     the existing test), its fourth is the hash of `{ name: 'first' }`, and it
     ends `comments/[ID]`. Get the value by running the test once without the
     inline snapshot argument filled (vitest writes a missing inline snapshot
     on a normal run) or by computing it, never with `-u`.
   - Add `throws naming the missing ancestor at any depth`: the three-level
     comment with `spaces/space-1` present but `spaces/space-1/entries/entry-1`
     missing. Pin the error with `toThrowErrorMatchingInlineSnapshot`. It must
     name `spaces/space-1/entries/entry-1` and the `spaces/space-1/entries`
     collection.
   - Leave the existing 2- and 4-segment tests' snapshots untouched. They are
     the proof that existing output does not change.

## Gotchas

- Never run tests with `-u`. Changed inline snapshots are edited by hand, and a
  new one is filled by a normal run that writes a missing snapshot. Then read
  the written value and check it matches the expectations above.
- Build ancestor paths from the original ids. Mutating the segments array in
  place and then slicing it for the next ancestor would look up a hashed path
  and throw `Document not found`.
- `getDBChanges` passes the after docs for added, modified and unmodified docs,
  and the before docs for removed docs. A removed nested document whose ancestor
  was also removed still resolves, because both are in the before docs. Do not
  change `getDBChanges`.
- No `await` inside `expect(...)`. No mid-sentence semicolons in prose,
  comments or the error message.
- `tsconfig.json` includes all of `src`, so `yarn build` type-checks the test
  file too.
- Stage only `src/testing/internal/DocumentChangeSnapshot.ts` and
  `src/testing/internal/DocumentChangeSnapshot.test.ts` by path. The owner's
  uncommitted dependency update (`package.json` files, `yarn.lock`,
  `.yarnrc.yml`, `.yarn/releases/`) stays uncommitted. Never `git add -A` or
  `git add .`.
- Format only the two touched files (for example
  `yarn prettier --write <the two paths>`), not `yarn format` over the repo.
- Not breaking: commit as `feat(admin): ...` or `fix(admin): ...` with no
  `BREAKING CHANGE:` footer of its own (the branch's squashed commit already
  carries one for other changes).

## Verification

- `yarn test:unit` from the repo root, green. This includes the updated
  `src/testing/internal/DocumentChangeSnapshot.test.ts` (new any-depth hash test,
  new deep missing-ancestor test, updated missing-parent message, deleted
  depth-limit test) and the unchanged `src/testing/internal/getDBChanges.test.ts`
  and `src/testing/internal/formatDBChanges.test.ts`.
- `yarn test:emulator`, green, since `getDBChangesDiff` and `expectNoDBChanges`
  emulator tests run through `getDocPath`. No existing snapshot may change.
- `Check`: `yarn lint` and `yarn build`, both green.
