import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    mockReset: true,
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  },
})
