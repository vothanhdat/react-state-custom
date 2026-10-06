import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup-user-timing.ts', './tests/setup.ts'],
    testTimeout: 5000,
    hookTimeout: 5000,
    teardownTimeout: 5000,
    watch: false,
    // Use forks pool for better Yarn PnP compatibility with ESM
    pool: 'forks',
    // Ensure proper environment setup for jsdom
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    // Exclude config files from test collection
    exclude: [
      // run with the React Compiler by vitest.config.compiler.ts (yarn test:compiler)
      'tests/compiler/**',
      // measurement scenarios with their own config (demos/*/vitest.config.mjs), not assertions
      'demos/**',
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/dev/**',
        'src/playground/**',
        'src/examples/**',
        'src/vite-env.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
