import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Benchmarks render without StrictMode (no setup file) so render counts are the ones an app sees.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['bench/**/*.bench.tsx'],
    watch: false,
    pool: 'forks',
    benchmark: {
      include: ['bench/**/*.bench.tsx'],
      reporters: ['default'],
    },
  },
  resolve: {
    alias: { '@': resolve(__dirname, './src') },
  },
})
