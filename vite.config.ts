import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts'
import { analyzer } from 'vite-bundle-analyzer'
import "babel-plugin-react-compiler"

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"]
      }
    }),
    dts({
      include: ['src'],
    }),
    analyzer({
      analyzerMode: "server",
      openAnalyzer: true
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'RState',
      fileName: (format) => `index.${format}.js`,
      formats: ['es', 'umd'],
    },
    rollupOptions: {
      // Ensure to externalize deps that shouldn't be bundled
      external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      output: {
        globals: {
          'react': 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    sourcemap: true
  },
  server: {
    port: 3000,
    open: "./dev.html"
  },
});