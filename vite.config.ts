import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts'

// The React Compiler is for the examples only (they are written without useCallback/useMemo).
// The library itself must never be compiled: it reads mutable data and tracks reads during render
// on purpose, and compiler memoisation changes that behaviour (e.g. it cached the useStore proxy).
const isExample = (id: string) => /[\\/]src[\\/]examples[\\/]/.test(id)

export default defineConfig({
  plugins: [
    react({
      babel: (id) => ({ plugins: isExample(id) ? ["babel-plugin-react-compiler"] : [] }),
    }),
    dts({
      include: ['src/index.ts', 'src/state-utils', 'src/dev-tool'],
    }),
  ],
  build: {
    lib: {
      // Three entries: the state library, the dev tool (which carries the only CSS), and the
      // react-obj-view renderer for the dev tool (so that optional peer stays out of the other two).
      entry: {
        'index': 'src/index.ts',
        'dev-tool': 'src/dev-tool/index.ts',
        'dev-tool/obj-view': 'src/dev-tool/obj-view.tsx',
      },
      formats: ['es', 'cjs'],
      // package.json has "type": "module", so CommonJS output must use the .cjs extension
      fileName: (format, entryName) => format === 'es' ? `${entryName}.es.js` : `${entryName}.cjs`,
      cssFileName: 'react-state-custom',
    },
    rollupOptions: {
      // Ensure to externalize deps that shouldn't be bundled
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-obj-view'],
    },
    sourcemap: true
  },
  server: {
    port: 3000,
    open: "./dev.html"
  },
});
