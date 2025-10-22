import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/react-state-custom/',
  plugins: [
    react(),
  ],
  build: {
    target: 'esnext',
    outDir: 'demo-dist',
  },
  server: {
    port: 3000,
  },
});