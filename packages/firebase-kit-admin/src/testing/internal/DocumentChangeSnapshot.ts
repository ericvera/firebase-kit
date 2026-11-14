import type { QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { diff } from 'jest-diff'
import { formatDocPath } from './formatDocPath.js'
import type { DocPathSegment } from './getDocPathSegments.js'

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

// Proposed base class
abstract class BaseDocumentSnapshot {
  public readonly normalizedPath: string

  constructor(
    protected readonly doc: QueryDocumentSnapshot,
    public readonly pathSegments: readonly DocPathSegment[],
    protected readonly normalizedData?: unknown,
  ) {
    this.normalizedPath = formatDocPath(pathSegments)
  }

  abstract getDiff(): string | undefined
}

export class AddedDocumentSnapshot extends BaseDocumentSnapshot {
  public readonly addedDoc: QueryDocumentSnapshot

  private normalizedAddedData: unknown

  constructor(
    addedDoc: QueryDocumentSnapshot,
    normalizedAddedData: unknown,
    pathSegments: readonly DocPathSegment[],
  ) {
    super(addedDoc, pathSegments, normalizedAddedData)
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
    pathSegments: readonly DocPathSegment[],
  ) {
    super(removedDoc, pathSegments, normalizedRemovedData)
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
    pathSegments: readonly DocPathSegment[],
  ) {
    super(afterDoc, pathSegments, normalizeAfterData)
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
