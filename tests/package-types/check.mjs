// Type-checks tests/package-types/consumer.ts against the built package (dist/, through package.json
// "exports" and "typesVersions") under each module resolution an app can use, the way the app's own
// tsc would: with skipLibCheck off, so an error inside the published declarations shows too.
// Run after `yarn build`: yarn test:package-types
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const tsc = join(repo, 'node_modules/typescript/bin/tsc')

/** One app per setup: its package type, the consumer's extension and its compiler options. */
const setups = [
  { name: 'bundler', type: 'module', ext: '.ts', module: 'esnext', moduleResolution: 'bundler' },
  { name: 'node10 (CommonJS)', type: 'commonjs', ext: '.ts', module: 'commonjs', moduleResolution: 'node10' },
  { name: 'node16, ESM', type: 'module', ext: '.mts', module: 'node16', moduleResolution: 'node16' },
  { name: 'node16, CommonJS', type: 'commonjs', ext: '.cts', module: 'node16', moduleResolution: 'node16' },
  { name: 'nodenext, ESM', type: 'module', ext: '.mts', module: 'nodenext', moduleResolution: 'nodenext' },
  { name: 'nodenext, CommonJS', type: 'commonjs', ext: '.cts', module: 'nodenext', moduleResolution: 'nodenext' },
]

const work = mkdtempSync(join(tmpdir(), 'rsc-package-types-'))
let failed = 0
try {
  for (const setup of setups) {
    const app = join(work, setup.name.replace(/\W+/g, '-'))
    mkdirSync(join(app, 'node_modules/@types'), { recursive: true })
    // the package as installed, and the React types its declarations import
    symlinkSync(repo, join(app, 'node_modules/react-state-custom'), 'dir')
    for (const pkg of ['react', 'react-dom', 'react-obj-view']) symlinkSync(join(repo, 'node_modules', pkg), join(app, 'node_modules', pkg), 'dir')
    for (const pkg of ['react', 'react-dom']) symlinkSync(join(repo, 'node_modules/@types', pkg), join(app, 'node_modules/@types', pkg), 'dir')
    writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app', private: true, type: setup.type }))
    copyFileSync(join(repo, 'tests/package-types/consumer.ts'), join(app, 'consumer' + setup.ext))
    writeFileSync(join(app, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true, noEmit: true, skipLibCheck: false, jsx: 'react-jsx', types: [],
        target: 'es2022', module: setup.module, moduleResolution: setup.moduleResolution,
      },
      files: ['consumer' + setup.ext],
    }))
    try {
      execFileSync(process.execPath, [tsc, '-p', app], { encoding: 'utf8', stdio: 'pipe' })
      console.log(`ok    ${setup.name}`)
    } catch (error) {
      failed++
      console.log(`FAIL  ${setup.name}\n${String(error.stdout).split(app + '/').join('').replace(/^/gm, '      ')}`)
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
process.exit(failed ? 1 : 0)
