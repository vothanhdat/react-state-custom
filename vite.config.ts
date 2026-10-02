import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts'
import "babel-plugin-react-compiler"

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"]
      }
    }),
    dts({
      include: ['src/index.ts', 'src/state-utils', 'src/dev-tool'],
    }),
  ],
  build: {
    lib: {
      // Two entries: the state library, and the dev tool (which carries the only CSS and UI dependency).
      entry: {
        'index': 'src/index.ts',
        'dev-tool': 'src/dev-tool/index.ts',
      },
      formats: ['es', 'cjs'],
      // package.json has "type": "module", so CommonJS output must use the .cjs extension
      fileName: (format, entryName) => format === 'es' ? `${entryName}.es.js` : `${entryName}.cjs`,
      cssFileName: 'react-state-custom',
    },
    rollupOptions: {
      // Ensure to externalize deps that shouldn't be bundled
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    },
    sourcemap: true
  },
  server: {
    port: 3000,
    open: "./dev.html"
  },
});
