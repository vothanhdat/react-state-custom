import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// A plain production build of the bench page: React in production mode, no React plugin or compiler.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  esbuild: { jsx: 'automatic' },
  build: { outDir: 'dist', emptyOutDir: true, target: 'es2022' },
  logLevel: 'warn',
})
