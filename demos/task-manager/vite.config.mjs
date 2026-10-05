// The browser page: yarn demo:tasks (http://localhost:5181)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5181,
    fs: { allow: [fileURLToPath(new URL('../..', import.meta.url))] },   // the page imports ../../src
  },
})
