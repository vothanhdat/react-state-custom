// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { build, type Rollup } from 'vite'
import { resolve } from 'path'

/**
 * Development-only code must disappear from an app's production bundle. The checks read `isProduction`,
 * a constant set to `process.env.NODE_ENV === 'production'`: the app's bundler replaces the expression
 * and its minifier folds the constant and drops the branches. A constant computed at runtime (it was
 * wrapped in a try/catch) kept every branch and its warning text.
 * This bundles the library source as an app does (Vite, production and development modes).
 */

const root = resolve(__dirname, '..')

/** Text of warnings and errors that only development builds report. */
const devOnly = [
  'was spread during render',               // useQuickSubscribe: spread warning
  'is read-only. A write here',             // useQuickSubscribe: write through the proxy
  'was read outside of render',             // useQuickSubscribe: untracked read
  'More than one <AutoRootCtx',             // second root in a scope
  'changed identity',                       // inline Wrapper / debugging renderer
  'Two different stores are named',         // duplicate store name
  'was called with a selector',             // selector toggled at a call site
  'is used but no <AutoRootCtx',            // store without a root
  'which the store has set back',           // useStoreSuspense(params, keys): cleared key
  'rendered from initialState',             // useStoreSuspense: seed reads
  'Circular dependency detected',           // DependencyTracker
]

const bundle = async (mode: 'production' | 'development') => {
  // Vite takes NODE_ENV from the environment when it is set, and vitest sets it to "test"
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = mode
  try {
    return await bundleIn(mode)
  } finally {
    process.env.NODE_ENV = previous
  }
}

const bundleIn = async (mode: 'production' | 'development') => {
  const output = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    mode,
    build: {
      write: false,
      minify: 'esbuild',
      rollupOptions: {
        input: resolve(root, 'src/index.ts'),
        preserveEntrySignatures: 'strict',
        external: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
      },
    },
  }) as Rollup.RollupOutput
  return output.output.map(chunk => chunk.type === 'chunk' ? chunk.code : '').join('\n')
}

describe('production bundles', () => {
  it('contain no development-only code', async () => {
    // one after the other: each sets NODE_ENV for its build
    const production = await bundle('production')
    const development = await bundle('development')
    // the test can see the messages when they are there
    for (const text of devOnly) expect(development, text).toContain(text)
    for (const text of devOnly) expect(production, text).not.toContain(text)
    expect(production).not.toContain('NODE_ENV')
  }, 30_000)
})
