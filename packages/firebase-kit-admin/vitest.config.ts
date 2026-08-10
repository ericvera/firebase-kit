import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

// Group membership is decidable from a file's name alone: a test that needs a
// live Firestore instance is named `*.emulator.test.ts`, and every other
// `*.test.ts` belongs to the unit group.
const EmulatorTestGlob = '**/*.emulator.test.ts'
const UnitTestGlob = '**/*.test.ts'

const SharedExclude = ['**/node_modules/**', '**/dist/**']

// `src` rather than the package directory, so the `__mocks__` folder vitest
// resolves relative to the root sits under the tsconfig's `rootDir` too — that
// is what lets a test import a shim's controls directly and typed.
const SourceRoot = join(import.meta.dirname, 'src')

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          root: SourceRoot,
          include: [UnitTestGlob],
          exclude: [...SharedExclude, EmulatorTestGlob],
          // Projects do not inherit the root `test` block, so this has to be
          // repeated in each one or mock state leaks between tests.
          mockReset: true,
        },
      },
      {
        test: {
          name: 'emulator',
          root: SourceRoot,
          include: [EmulatorTestGlob],
          exclude: SharedExclude,
          mockReset: true,
          setupFiles: ['./__test__/setup/vi.setup.ts'],
        },
      },
    ],
  },
})
