import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Mirrors apps/dashboard/vitest.config.ts. `packages/*` ship raw TypeScript
// with no build step, so Next transpiles them via `transpilePackages` and
// vitest needs the equivalent — aliases straight at the sources. The
// trailing-slash entries keep subpath imports (`@useroutr/ui/globals.css`)
// resolving instead of being rewritten onto the index file.
const workspaceRoot = path.resolve(__dirname, '../..')

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // The app is not under `src/`, so scope the run to the test directory
    // rather than letting vitest walk `.next/` and `node_modules`.
    include: ['__tests__/**/*.test.{ts,tsx}'],
    alias: [
      // Matches the `@/*` -> `./*` mapping in tsconfig.json.
      { find: '@/', replacement: __dirname + '/' },
      {
        find: /^@useroutr\/ui$/,
        replacement: path.join(workspaceRoot, 'packages/ui/src/index.ts'),
      },
      {
        find: /^@useroutr\/ui\//,
        replacement: path.join(workspaceRoot, 'packages/ui/src') + '/',
      },
      {
        find: /^@useroutr\/types$/,
        replacement: path.join(workspaceRoot, 'packages/types/src/index.ts'),
      },
      {
        find: /^@useroutr\/types\//,
        replacement: path.join(workspaceRoot, 'packages/types/src') + '/',
      },
    ],
  },
})
