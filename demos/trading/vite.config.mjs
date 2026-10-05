import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('../../src/', import.meta.url))

// The demo imports the library by its package name; the aliases point it at the sources in this repo.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react-state-custom\/testing$/, replacement: src + 'testing/index.ts' },
      { find: /^react-state-custom\/schedulers$/, replacement: src + 'schedulers/index.ts' },
      { find: /^react-state-custom\/dev-tool$/, replacement: src + 'dev-tool/index.ts' },
      { find: /^react-state-custom\/style\.css$/, replacement: src + 'dev-tool/DevTool.css' },
      { find: /^react-state-custom$/, replacement: src + 'index.ts' },
    ],
  },
  server: { port: 3100 },
  build: { target: 'esnext', outDir: 'dist' },
})
