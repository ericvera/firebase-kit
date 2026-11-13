# 01_01 Firestore read helpers: getDocumentsFromQuery and getDocuments

## Goal

Add two typed read helpers to `firebase-kit-admin/firestore`:

- `getDocumentsFromQuery(query, reader?)` returns every document a query matches
  as `{ id, ...data }`.
- `getDocuments(refs, reader?)` reads many refs in one batch and returns one entry
  per ref, in order: the `{ id, ...data }` entity, or `undefined` when that
  document does not exist.

## Files to modify/create

All under `/Users/eric/Code/firebase-kit/packages/firebase-kit-admin/`:

- `src/firestore/getDocumentsFromQuery.ts` (create)
- `src/firestore/getDocuments.ts` (create)
- `src/firestore/index.ts` (modify)
- `README.md` (modify)

Tests (do not count): `src/firestore/getDocumentsFromQuery.emulator.test.ts`,
`src/firestore/getDocuments.emulator.test.ts`.

## Background

- Monorepo of published `firebase-kit-*` packages, Yarn 4 workspaces, ESM,
  TypeScript strictest (`noUncheckedIndexedAccess` is on). Imports use `.js`
  suffixes.
- Callers repeat `snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))`
  for multi-document queries, and Firestore's instance-level `getAll` lacks the
  generic overload `Transaction.getAll` has, so callers hand-write a cast.
- Patterns to follow:
  - `src/firestore/checkDocumentExists.ts:15-43`: positional optional
    `reader?: TransactionReader`, `reader ? await reader.get(ref) : await ref.get()`,
    generic pair `<T extends { id: string } & DBT, DBT extends DocumentData>`,
    return `{ id, ...data } as T`.
  - `src/firestore/checkDocumentInQueryExists.ts:38-70`: the query variant of the
    same mapping.
  - `src/firestore/internal/TransactionReader.ts:56-60`: `reader.getAll(...refs)`,
    already generic.
  - Emulator tests: `src/firestore/checkDocumentInQueryExists.emulator.test.ts`
    (imports, `vi.hoisted(() => { vi.resetModules() })`, `setFakeTimer`,
    `addPersonToDB`, `personRefs.personByHandleQuery`, transaction cases via
    `testDB.runTransaction(async (reader) => ...)`, `normalizeData` before inline
    snapshots). Fixtures live in `src/__test__/db/` (`personRefs`, `spaceRefs`,
    `addSpaceToDB`, `TestPersonID1`, `TestPersonID2`, `TestSpaceID1`).
- Design decisions:
  - Both helpers share one shape: typed `{ id, ...data }` results and an optional
    `TransactionReader` as the last positional argument.
  - A missing document in `getDocuments` is `undefined` in its position, so the
    result lines up with `refs`. Never skipped, never thrown.
  - Names: `getDocumentsFromQuery` and `getDocuments` (consistent with
    `checkDocumentExists` / `checkDocumentInQueryExists`).

## Guides

None. The mise config lists no Skills & guides entries.

## Implementation details

1. `getDocumentsFromQuery.ts`:

   ```ts
   export const getDocumentsFromQuery = async <
     T extends DBT & { id: string },
     DBT extends DocumentData,
   >(query: Query<DBT, DBT>, reader?: TransactionReader): Promise<T[]>
   ```

   Read with `reader ? await reader.get(query) : await query.get()`, map
   `snapshot.docs` to `{ id: doc.id, ...doc.data() } as T`. JSDoc: what it returns,
   that it reads through the reader when given, and that an empty query returns
   `[]`.

2. `getDocuments.ts`:

   ```ts
   export const getDocuments = async <
     T extends DBT & { id: string },
     DBT extends DocumentData,
   >(
     refs: DocumentReference<DBT, DBT>[],
     reader?: TransactionReader,
   ): Promise<(T | undefined)[]>
   ```

   - `const [first] = refs; if (!first) return []` before any read (Firestore's
     `getAll` throws with zero arguments).
   - With a reader: `await reader.getAll(...refs)`.
   - Without: `(await first.firestore.getAll(...refs)) as DocumentSnapshot<DBT, DBT>[]`,
     with a one-line comment that the instance-level `getAll` drops the
     converter's type, which is the cast this helper exists to hide.
   - Map each snapshot: `const data = snapshot.data(); return data ? ({ id: snapshot.id, ...data } as T) : undefined`.
   - JSDoc: one entry per ref, in order, `undefined` for a missing document.

3. `src/firestore/index.ts`: add `export * from './getDocuments.js'` and
   `export * from './getDocumentsFromQuery.js'` in alphabetical order with the
   existing `export *` lines.

4. `README.md` (admin):
   - In `### firebase-kit-admin/firestore` usage (after the
     `checkDocumentInQueryExists` paragraph near line 285), add a short paragraph
     and one TypeScript block (with a `// src/...` path header comment, same style
     as the surrounding examples, reusing `spaceRefs`/`DBSpace` from the earlier
     `src/spaces/spaceRefs.ts` example) showing both helpers.
   - Entry Points table row for `firebase-kit-admin/firestore` (near line 113):
     mention the two new helpers. Keep the table aligned (run `yarn format`).
   - API Reference `### firebase-kit-admin/firestore` (near line 680): add
     `getDocumentsFromQuery(query, reader?)` and `getDocuments(refs, reader?)`
     bullets in the same style.
   - Do not restate any dependency version range.

## Gotchas

- The repo's test file convention: `vi.mock` calls sit directly below the
  imports, `vi.hoisted` state above them, every other declaration below.
- `noUncheckedIndexedAccess`: destructure with a guard rather than `refs[0]!`.
- Do not export `TransactionReader` as a value; it stays type-only in
  `firestore/index.ts`.
- `getAll` with duplicate refs returns duplicates; no dedup is needed, but don't
  add any.

## Verification

- Write `src/firestore/getDocumentsFromQuery.emulator.test.ts`: empty query
  returns `[]`; two matching docs return both with `id` (inline snapshot through
  `normalizeData`, sort by id first if order is not guaranteed); same through a
  transaction reader.
- Write `src/firestore/getDocuments.emulator.test.ts`: existing + missing ref
  returns `[entity, undefined]` in ref order; order follows refs when passed
  reversed; empty `refs` returns `[]`; same existing+missing case through a
  transaction reader.
- Run from `/Users/eric/Code/firebase-kit`: `yarn format`, `yarn lint`,
  `yarn build`, `yarn test:unit`, `yarn test:emulator`.
- README snippet: per the config's test exceptions, `yarn pack` the admin package
  into a throwaway consumer project outside the repo and type-check the new
  snippet verbatim (extracted to the path in its header comment, alongside the
  `src/firebase/db.ts` and `src/spaces/spaceRefs.ts` blocks it imports).
