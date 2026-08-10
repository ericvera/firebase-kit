import { expect, it } from 'vitest'
import { createFirebaseAdminStorageMock } from './createFirebaseAdminStorageMock.js'

/** The `File` surface the faked bucket hands back. */
interface MockFile {
  save: (
    content: Buffer | string,
    options?: { contentType?: string },
  ) => Promise<undefined>
  download: () => Promise<[Buffer]>
  delete: () => Promise<unknown[]>
  exists: () => Promise<[boolean]>
  makePublic: () => Promise<unknown[]>
  makePrivate: () => Promise<unknown[]>
}

/** The `Bucket` surface the faked storage instance hands back. */
interface MockBucket {
  file: (filePath: string) => MockFile
}

/** The instance the faked module entry points hand back. */
interface MockStorage {
  bucket: () => MockBucket
}

const createMock = () => {
  const mock = createFirebaseAdminStorageMock()

  mock.resetStorageMock()

  // The factory's spies are deliberately untyped `vi.fn()`s, which makes
  // everything reached through them `any`. The chain is named here instead, so
  // the published mock keeps its types and the cases below keep their shape.
  const getStorage: () => MockStorage = mock.getStorage

  return { ...mock, getStorage }
}

it('saves a file and reads its content back', async () => {
  const mock = createMock()

  await mock
    .getStorage()
    .bucket()
    .file('documents/first.yaml')
    .save('items: []')

  // Verify: the in-memory file system holds what was written, which is what a
  // caller test asserts on instead of hitting Cloud Storage
  expect(mock.getFileContent('documents/first.yaml')).toEqual('items: []')
  expect(mock.fileExists('documents/first.yaml')).toEqual(true)
})

it('records the content type and size a save was made with', async () => {
  const mock = createMock()

  await mock
    .getStorage()
    .bucket()
    .file('documents/first.yaml')
    .save('items: []', { contentType: 'text/yaml' })

  const metadata = mock.getFileMetadata('documents/first.yaml')

  // Verify: metadata is derived from the save rather than hard-coded, so a
  // caller asserting on content type is testing its own call
  expect(metadata?.contentType).toEqual('text/yaml')
  expect(metadata?.size).toEqual('items: []'.length)
})

it('keeps the original creation time when a file is saved again', async () => {
  const mock = createMock()

  const file = mock.getStorage().bucket().file('documents/first.yaml')

  await file.save('first')

  const created = mock.getFileMetadata('documents/first.yaml')?.createdAt

  await file.save('second')

  // Verify: a re-save is an update, not a new file — the created time survives
  // so a caller can tell the two apart
  expect(mock.getFileMetadata('documents/first.yaml')?.createdAt).toEqual(
    created,
  )
  expect(mock.getFileContent('documents/first.yaml')).toEqual('second')
})

it('downloads the saved content as a buffer', async () => {
  const mock = createMock()

  const file = mock.getStorage().bucket().file('documents/first.yaml')

  await file.save('items: []')

  const [buffer] = await file.download()

  // Verify: download returns the SDK's buffer-in-an-array shape, holding what
  // was saved rather than a fixed placeholder
  expect(buffer.toString()).toEqual('items: []')
})

it('falls back to placeholder content for a file that was never saved', async () => {
  const mock = createMock()

  const [buffer] = await mock
    .getStorage()
    .bucket()
    .file('documents/missing.yaml')
    .download()

  // Verify: reading an unknown path yields a stand-in rather than throwing, so
  // a test that only cares about the call still runs
  expect(buffer.toString()).toEqual('test image data')
})

it('reports a deleted file as absent', async () => {
  const mock = createMock()

  const file = mock.getStorage().bucket().file('documents/first.yaml')

  await file.save('items: []')
  await file.delete()

  // Verify: delete removes the entry rather than blanking it, so exists() and
  // the path listing both agree
  expect(mock.fileExists('documents/first.yaml')).toEqual(false)
  expect(mock.getAllFilePaths()).toEqual([])
})

it('tracks public and private visibility per file', async () => {
  const mock = createMock()

  const file = mock.getStorage().bucket().file('documents/first.yaml')

  await file.save('items: []')
  await file.makePublic()

  expect(mock.getFileMetadata('documents/first.yaml')?.isPublic).toEqual(true)

  await file.makePrivate()

  // Verify: visibility is state the caller can assert on, and it flips both
  // ways rather than latching
  expect(mock.getFileMetadata('documents/first.yaml')?.isPublic).toEqual(false)
})

it('reports exists per file rather than globally', async () => {
  const mock = createMock()

  const bucket = mock.getStorage().bucket()

  await bucket.file('documents/first.yaml').save('items: []')

  const [saved] = await bucket.file('documents/first.yaml').exists()
  const [missing] = await bucket.file('documents/other.yaml').exists()

  // Verify: the selected path decides the answer — a shared flag would make
  // every existence check agree with the last one written
  expect(saved).toEqual(true)
  expect(missing).toEqual(false)
})

it('clears the file system on reset', async () => {
  const mock = createMock()

  await mock
    .getStorage()
    .bucket()
    .file('documents/first.yaml')
    .save('items: []')

  mock.resetStorageMock()

  // Verify: one test's uploads cannot leak into the next
  expect(mock.getAllFilePaths()).toEqual([])
})

it('snapshots every stored file at once', async () => {
  const mock = createMock()

  const bucket = mock.getStorage().bucket()

  await bucket.file('a.txt').save('first')
  await bucket.file('b.txt').save('second')

  // Verify: the snapshot is keyed by path, so a caller can assert on the whole
  // bucket in one expectation
  expect(Object.keys(mock.getFileSnapshot()).sort()).toEqual(['a.txt', 'b.txt'])
})
