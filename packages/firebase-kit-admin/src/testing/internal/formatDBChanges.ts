import { compareCodeUnits } from './compareCodeUnits.js'
import { compareDocPaths } from './compareDocPaths.js'
import type { DBSnapshotChanges } from './DocumentChangeSnapshot.js'
import type { DocPathSegment } from './getDocPathSegments.js'

const TextLine = '--------------------------------'

const KindOrder = { ADDED: 0, MODIFIED: 1, REMOVED: 2 }

interface Section {
  kind: keyof typeof KindOrder
  path: string
  pathSegments: readonly DocPathSegment[]
  body: string
}

// The first line of an added or removed diff only shows the empty object the
// document is compared against, so it is dropped.
const dropFirstLine = (text: string): string =>
  text.split('\n').slice(1).join('\n')

// Path comes first so a document's section sits directly above the sections
// of the documents in its subcollections. The body breaks the last ties, so
// the order documents happened to be read in cannot churn a snapshot.
const compareSections = (a: Section, b: Section): number =>
  compareDocPaths(a.pathSegments, b.pathSegments) ||
  KindOrder[a.kind] - KindOrder[b.kind] ||
  compareCodeUnits(a.body, b.body)

/**
 * Renders a changes object as the printable DB DIFF text. Timestamps and
 * Buffers come out already normalized (`/Timestamp 0000/`, `/Buffer .../`).
 */
export const formatDBChanges = (changes: DBSnapshotChanges): string => {
  const sections: Section[] = [
    ...changes.added.map((snapshot) => ({
      kind: 'ADDED' as const,
      path: snapshot.normalizedPath,
      pathSegments: snapshot.pathSegments,
      body: dropFirstLine(snapshot.getDiff() ?? ''),
    })),
    ...changes.modified.map((snapshot) => ({
      kind: 'MODIFIED' as const,
      path: snapshot.normalizedPath,
      pathSegments: snapshot.pathSegments,
      body: snapshot.getDiff() ?? '',
    })),
    ...changes.removed.map((snapshot) => ({
      kind: 'REMOVED' as const,
      path: snapshot.normalizedPath,
      pathSegments: snapshot.pathSegments,
      body: dropFirstLine(snapshot.getDiff() ?? ''),
    })),
  ]

  const results = sections
    .sort(compareSections)
    .map(
      ({ kind, path, body }) =>
        `${TextLine}\n ${kind} (path: ${path})\n${TextLine}\n${body}`,
    )

  return `DB DIFF\n\n${results.join(`\n${TextLine}\n\n`)}`
}
