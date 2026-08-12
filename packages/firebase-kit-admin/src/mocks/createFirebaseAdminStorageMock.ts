import { type Mock, vi } from 'vitest'

/** One file held by the in-memory bucket. */
interface FileRecord {
  content: string
  contentType?: string | undefined
  size: number
  createdAt: Date
  updatedAt: Date
  isPublic: boolean
}

/**
 * Builds the stand-in a test suite re-exports from its
 * `__mocks__/firebase-admin/storage` module, so a bare
 * `vi.mock('firebase-admin/storage')` gives tests an in-memory bucket instead
 * of a real Cloud Storage one. Returns the module members the suite needs, the
 * individual spies for call assertions, and helpers that read the resulting
 * file system back.
 */
export const createFirebaseAdminStorageMock = () => {
  const fileSystem = new Map<string, FileRecord>()

  // The bucket API selects a file and then acts on it, so every operation
  // below reads the path the last `file()` call named.
  let currentFilePath: string | undefined

  // Each spy is annotated rather than left inferred: an inferred `vi.fn()` is
  // `Mock<Procedure>`, and `Procedure` is declared in `@vitest/spy`, which
  // `vitest` does not re-export — so declaration emit would name a module this
  // package does not declare. `Mock` is `Mock<Procedure>`, so nothing narrows.
  const bucketMock: Mock = vi.fn()
  const getFilesMock: Mock = vi.fn()
  const createMock: Mock = vi.fn()
  const fileMock: Mock = vi.fn()
  const downloadMock: Mock = vi.fn()
  const uploadMock: Mock = vi.fn()
  const saveMock: Mock = vi.fn()
  const deleteMock: Mock = vi.fn()
  const existsMock: Mock = vi.fn()
  const getMetadataMock: Mock = vi.fn()
  const makePublicMock: Mock = vi.fn()
  const makePrivateMock: Mock = vi.fn()

  const storage = {
    bucket: bucketMock,
    app: {
      name: 'test-app',
    },
  }

  const getCurrentRecord = (): FileRecord | undefined =>
    currentFilePath === undefined ? undefined : fileSystem.get(currentFilePath)

  const getStorage = vi.fn(() => storage)
  const initializeStorage = vi.fn(() => storage)

  const getFileContent = (filePath: string): string | undefined =>
    fileSystem.get(filePath)?.content

  const getFileMetadata = (
    filePath: string,
  ): Omit<FileRecord, 'content'> | undefined => {
    const record = fileSystem.get(filePath)

    if (record === undefined) {
      return undefined
    }

    const { content, ...metadata } = record

    return metadata
  }

  const getFileSnapshot = (): Record<string, FileRecord> =>
    Object.fromEntries(fileSystem)

  const fileExists = (filePath: string): boolean => fileSystem.has(filePath)

  const getAllFilePaths = (): string[] => Array.from(fileSystem.keys())

  const resetStorageMock = () => {
    fileSystem.clear()
    currentFilePath = undefined

    // Each implementation below builds its promise explicitly rather than
    // being declared `async`: none of them awaits anything, and the result
    // still has to be a promise because that is what the real SDK returns.
    downloadMock.mockImplementation(() => {
      const record = getCurrentRecord()

      if (record === undefined) {
        return Promise.resolve([Buffer.from('test image data')])
      }

      return Promise.resolve([Buffer.from(record.content)])
    })

    uploadMock.mockImplementation(() => {
      if (currentFilePath === undefined) {
        return Promise.resolve([{ name: 'test-file.png' }])
      }

      const now = new Date()

      fileSystem.set(currentFilePath, {
        content: 'uploaded file content',
        contentType: 'application/octet-stream',
        size: 'uploaded file content'.length,
        createdAt: now,
        updatedAt: now,
        isPublic: false,
      })

      return Promise.resolve([{ name: currentFilePath }])
    })

    saveMock.mockImplementation(
      (content: Buffer | string, options?: { contentType?: string }) => {
        if (currentFilePath === undefined) {
          return Promise.resolve(undefined)
        }

        const contentString = Buffer.isBuffer(content)
          ? content.toString()
          : content

        const now = new Date()
        const existing = fileSystem.get(currentFilePath)

        fileSystem.set(currentFilePath, {
          content: contentString,
          contentType: options?.contentType ?? existing?.contentType,
          size: contentString.length,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          isPublic: existing?.isPublic ?? false,
        })

        return Promise.resolve(undefined)
      },
    )

    deleteMock.mockImplementation(() => {
      if (currentFilePath !== undefined) {
        fileSystem.delete(currentFilePath)
      }

      return Promise.resolve([])
    })

    existsMock.mockImplementation(() => {
      if (currentFilePath === undefined) {
        return Promise.resolve([true])
      }

      return Promise.resolve([fileSystem.has(currentFilePath)])
    })

    getMetadataMock.mockImplementation(() => {
      const record = getCurrentRecord()

      if (record === undefined) {
        return Promise.resolve([
          { name: 'test-file.png', contentType: 'image/png' },
        ])
      }

      return Promise.resolve([
        {
          name: currentFilePath,
          contentType: record.contentType,
          size: record.size,
          timeCreated: record.createdAt.toISOString(),
          updated: record.updatedAt.toISOString(),
        },
      ])
    })

    makePublicMock.mockImplementation(() => {
      const record = getCurrentRecord()

      if (record !== undefined) {
        record.isPublic = true
        record.updatedAt = new Date()
      }

      return Promise.resolve([])
    })

    makePrivateMock.mockImplementation(() => {
      const record = getCurrentRecord()

      if (record !== undefined) {
        record.isPublic = false
        record.updatedAt = new Date()
      }

      return Promise.resolve([])
    })

    fileMock.mockImplementation((filePath: string) => {
      currentFilePath = filePath

      return {
        download: downloadMock,
        upload: uploadMock,
        save: saveMock,
        delete: deleteMock,
        exists: existsMock,
        getMetadata: getMetadataMock,
        makePublic: makePublicMock,
        makePrivate: makePrivateMock,
      }
    })

    bucketMock.mockReturnValue({
      file: fileMock,
      upload: uploadMock,
      exists: existsMock,
      delete: deleteMock,
      getFiles: getFilesMock,
      create: createMock,
    })
  }

  return {
    bucketMock,
    createMock,
    deleteMock,
    downloadMock,
    existsMock,
    fileExists,
    fileMock,
    getAllFilePaths,
    getFileContent,
    getFileMetadata,
    getFileSnapshot,
    getFilesMock,
    getMetadataMock,
    getStorage,
    initializeStorage,
    makePrivateMock,
    makePublicMock,
    resetStorageMock,
    saveMock,
    uploadMock,
  }
}
