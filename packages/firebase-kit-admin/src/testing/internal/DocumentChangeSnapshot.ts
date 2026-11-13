import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { diff } from 'jest-diff'
import { createHash } from 'node:crypto'
import { extractTimestamps } from './extractTimestamps.js'
import { normalizeData } from './normalizeData.js'

export interface DBSnapshotChanges {
  added: AddedDocumentSnapshot[]
  removed: RemovedDocumentSnapshot[]
  modified: ModifiedDocumentSnapshot[]
  unmodified: UnmodifiedDocumentSnapshot[]
}

const noop = <T>(a: T): T => a

const getDiff = (a: unknown, b: unknown): string | undefined => {
  const text = diff(a ?? {}, b ?? {}, {
    omitAnnotationLines: true,
    // Disable color markers generated for console logging
    aColor: noop,
    bColor: noop,
    commonColor: noop,
    changeColor: noop,
    patchColor: noop,
    contextLines: 0,
  })

  if (text?.includes('no visual difference') === true) {
    return
  }

  return text?.toString()
}

const generateHash = (data: unknown): string => {
  const hashData = JSON.stringify(data)
  return createHash('md5')
    .update(hashData)
    .digest('base64')
    .replaceAll(/[/\\+=]/g, 'a')
}

/**
 * Creates a normalized ID for a document path based on the content of the
 * document whose path is received (e.g. an ancestor of a subcollection item at
 * `childPath`).
 */
const getNormalizedIDForPath = (
  path: string,
  childPath: string,
  docs: QueryDocumentSnapshot[],
): string => {
  const doc = docs.find((d) => d.ref.path === path)

  if (!doc) {
    const collectionPath = path.split('/').slice(0, -1).join('/')
    throw new Error(
      `Document not found for path: ${path} (an ancestor of ${childPath}). Add a ref or query covering the ${collectionPath} collection to getDBSnapshot, so the ancestor is in the snapshot.`,
    )
  }

  const currentData = doc.data()

  // NOTE: This will only normalize the timestamps within the current document.
  // and not across all documents. So if there is a single timestamp it will
  // just be normalized to /Timestamp 0000/ rather than a timestamp matching
  // across the snapshot.

  // Extract and sort timestamps from this document
  const timestampValues = extractTimestamps(currentData)
  const sortedTimestamps = Array.from(timestampValues).sort()

  // Replace timestamps and buffers with normalized values
  const normalizedData = normalizeData(currentData, sortedTimestamps)

  return generateHash(normalizedData)
}

/**
 * Returns a normalized path for a document, replacing the last segment with
 * '[ID]' and every ancestor document id with a hash of that ancestor's
 * content. Every ancestor document must be in `allDocs`.
 */
const getDocPath = (
  doc: QueryDocumentSnapshot,
  allDocs: QueryDocumentSnapshot[],
): string => {
  const segments = doc.ref.path.split('/')
  const output = [...segments]

  for (let i = 1; i < segments.length - 1; i += 2) {
    output[i] = getNormalizedIDForPath(
      segments.slice(0, i + 1).join('/'),
      doc.ref.path,
      allDocs,
    )
  }

  output[output.length - 1] = '[ID]'

  return output.join('/')
}

// Proposed base class
abstract class BaseDocumentSnapshot {
  public readonly normalizedPath: string

  constructor(
    protected readonly doc: QueryDocumentSnapshot,
    allDocs: QueryDocumentSnapshot[],
    protected readonly normalizedData?: unknown,
  ) {
    this.normalizedPath = getDocPath(doc, allDocs)
  }

  abstract getDiff(): string | undefined
}

export class AddedDocumentSnapshot extends BaseDocumentSnapshot {
  public readonly addedDoc: QueryDocumentSnapshot

  private normalizedAddedData: unknown

  constructor(
    addedDoc: QueryDocumentSnapshot,
    normalizedAddedData: unknown,
    allDocs: QueryDocumentSnapshot[],
  ) {
    super(addedDoc, allDocs, normalizedAddedData)
    this.addedDoc = addedDoc
    this.normalizedAddedData = normalizedAddedData
  }

  /**
   * Returns a string with the differences between two objects or undefined if
   * there are no differences.
   * Timestamps are normalized to a string representation before comparison.
   */
  public getDiff(): string | undefined {
    return getDiff(undefined, this.normalizedAddedData)
  }
}

export class RemovedDocumentSnapshot extends BaseDocumentSnapshot {
  private normalizedRemovedData: unknown

  constructor(
    removedDoc: QueryDocumentSnapshot,
    normalizedRemovedData: unknown,
    allDocs: QueryDocumentSnapshot[],
  ) {
    super(removedDoc, allDocs, normalizedRemovedData)
    this.normalizedRemovedData = normalizedRemovedData
  }

  /**
   * Returns a string with the differences between two objects or undefined if
   * there are no differences.
   * Timestamps are normalized to a string representation before comparison.
   */
  public getDiff(): string | undefined {
    return getDiff(this.normalizedRemovedData, undefined)
  }
}

export class ModifiedDocumentSnapshot extends BaseDocumentSnapshot {
  public readonly beforeDoc: QueryDocumentSnapshot
  public readonly afterDoc: QueryDocumentSnapshot

  private normalizedBeforeData: unknown
  private normalizedAfterData: unknown

  constructor(
    beforeDoc: QueryDocumentSnapshot,
    afterDoc: QueryDocumentSnapshot,
    normalizeBeforeData: unknown,
    normalizeAfterData: unknown,
    allDocs: QueryDocumentSnapshot[],
  ) {
    super(afterDoc, allDocs, normalizeAfterData)
    this.beforeDoc = beforeDoc
    this.afterDoc = afterDoc

    this.normalizedBeforeData = normalizeBeforeData
    this.normalizedAfterData = normalizeAfterData
  }

  /**
   * Returns a string with the differences between two objects or undefined if
   * there are no differences.
   * Timestamps are normalized to a string representation before comparison.
   */
  public getDiff(): string | undefined {
    return getDiff(this.normalizedBeforeData, this.normalizedAfterData)
  }
}

export class UnmodifiedDocumentSnapshot extends BaseDocumentSnapshot {
  /**
   * Returns a string with the differences between two objects or undefined if
   * there are no differences.
   * Timestamps are normalized to a string representation before comparison.
   */
  public getDiff(): string | undefined {
    return
  }
}
