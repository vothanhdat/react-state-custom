import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts'
import { readFile, writeFile } from 'node:fs/promises'

// The React Compiler is for the examples only (they are written without useCallback/useMemo).
// The library itself must never be compiled: it reads mutable data and tracks reads during render
// on purpose, and compiler memoisation changes that behaviour (e.g. it cached the useStore proxy).
const isExample = (id: string) => /[\\/]src[\\/]examples[\\/]/.test(id)

/**
 * Point every relative import of a declaration file at the file itself: `./ctx` becomes `./ctx.js`
 * (or `./ctx.cjs`). Node16/NodeNext resolution requires the extension, and maps it to the
 * declaration file beside it (`ctx.d.ts`, `ctx.d.cts`); bundler and node10 resolution accept it too.
 */
const withExtension = (code: string, extension: '.js' | '.cjs') =>
  code.replace(/(\bfrom\s*|\bimport\s*\(\s*)(['"])(\.\.?\/[^'"]*?)\2/g, (match, lead, quote, path) =>
    /\.(c|m)?js$/.test(path) ? match : `${lead}${quote}${path}${extension}${quote}`)

/**
 * The package is "type": "module", so TypeScript reads its `.d.ts` files as ESM, and under
 * Node16/NodeNext resolution a `require` of them is an error. Each declaration file therefore gets
 * a CommonJS twin (`.d.cts`), which the "require" conditions of package.json "exports" point at.
 */
const writeDeclarations = async (emitted: Map<string, string>) => {
  for (const file of emitted.keys()) {
    if (!file.endsWith('.d.ts')) continue
    const code = await readFile(file, 'utf8')
    await writeFile(file, withExtension(code, '.js'))
    await writeFile(file.replace(/\.d\.ts$/, '.d.cts'), withExtension(code, '.cjs'))
  }
}

export default defineConfig({
  plugins: [
    react({
      babel: (id) => ({ plugins: isExample(id) ? ["babel-plugin-react-compiler"] : [] }),
    }),
    dts({
      include: ['src/index.ts', 'src/state-utils', 'src/dev-tool', 'src/testing', 'src/schedulers'],
      afterBuild: writeDeclarations,
    }),
  ],
  build: {
    lib: {
      // Five entries: the state library, the schedulers, the dev tool (which carries the only CSS),
      // the react-obj-view renderer for the dev tool (so that optional peer stays out of the other
      // ones), and the test helpers. Code they share goes into a common chunk, so the testing entry
      // reaches the same store registry as the library, and the schedulers the same queues.
      entry: {
        'index': 'src/index.ts',
        'schedulers': 'src/schedulers/index.ts',
        'dev-tool': 'src/dev-tool/index.ts',
        'dev-tool/obj-view': 'src/dev-tool/obj-view.tsx',
        'testing': 'src/testing/index.ts',
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
