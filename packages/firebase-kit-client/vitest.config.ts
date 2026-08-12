import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

// `src` rather than the package directory, so the `__mocks__` folder vitest
// resolves relative to the root sits under the tsconfig's `rootDir` too.
const SourceRoot = join(import.meta.dirname, 'src')

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // Named so the root orchestration can select the same project name
          // in every package. This package has no emulator tests.
          name: 'unit',
          root: SourceRoot,
          exclude: ['**/node_modules/**', '**/dist/**'],
          // Automatically reset after each test
          mockReset: true,
          setupFiles: ['./__test__/setup/vi.setup.ts'],
        },
      },
    ],
  },
})
