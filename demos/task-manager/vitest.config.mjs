// Runs the demo's scenarios against the library source: yarn vitest run --config demos/task-manager/vitest.config.mjs
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const repo = fileURLToPath(new URL('../..', import.meta.url))

export default {
  root: repo,
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [repo + 'tests/setup.ts'],
    dir: here,
    include: ['**/*.test.tsx'],
    testTimeout: 30000,
  },
}
