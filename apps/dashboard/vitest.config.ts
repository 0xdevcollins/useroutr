import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // The workspace packages ship raw TypeScript — their package.json `main`
    // and `exports` point straight at ./src. Next handles that via
    // `transpilePackages` in next.config.ts; vitest needs the equivalent, so
    // alias each one at its source entry and let vite transform it like any
    // other project file.
    //
    // These are ../../ from apps/dashboard, not ../ — the earlier one-level
    // paths resolved to apps/packages/*, which does not exist, and took out
    // every suite that transitively imported @useroutr/ui with "Failed to
    // resolve import".
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@useroutr/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@useroutr/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
})
