import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Runs the tests under tests/compiler with the React Compiler applied to them (and to the examples),
 * the way an app using babel-plugin-react-compiler would compile its own components and store hooks.
 * The library source itself is left as is, like the published package.
 */
export default defineConfig({
  plugins: [
    react({
      include: [/tests\/compiler\/.*\.tsx$/, /src\/examples\/.*\.tsx?$/],
      babel: { plugins: [['babel-plugin-react-compiler', { target: '19' }]] },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/compiler/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 5000,
    watch: false,
    pool: 'forks',
  },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
})
