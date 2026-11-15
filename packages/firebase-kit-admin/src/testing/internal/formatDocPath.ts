import type { DocPathSegment } from './getDocPathSegments.js'

/** Renders segments as the path a section header shows. */
export const formatDocPath = (segments: readonly DocPathSegment[]): string =>
  segments
    .map(({ collection, number }) =>
      number === undefined
        ? `${collection}/[ID]`
        : `${collection}/[ID ${String(number)}]`,
    )
    .join('/')
