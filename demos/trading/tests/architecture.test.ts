// @vitest-environment node
// The layers, and the only directions imports may go:
//   lib, sim/types            utilities and data contracts
//   domain                    plain functions: no React, no stores
//   stores/core               stores that own IO and data: they know nothing about the UI
//   stores/ui                 view-models: what the screens render, built from core
//   components, App, main     views: read stores/ui only
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const src = fileURLToPath(new URL('../src/', import.meta.url))

type Layer = 'lib' | 'types' | 'sim' | 'domain' | 'core' | 'ui' | 'view' | 'asset'

const layerOf = (file: string): Layer => {
  const rel = path.relative(src, file).split(path.sep).join('/')
  if (rel.endsWith('.css')) return 'asset'
  if (rel.startsWith('lib/')) return 'lib'
  if (rel === 'sim/types' || rel === 'sim/types.ts') return 'types'
  if (rel.startsWith('sim/')) return 'sim'
  if (rel.startsWith('domain/')) return 'domain'
  if (rel.startsWith('stores/core/')) return 'core'
  if (rel.startsWith('stores/ui/')) return 'ui'
  return 'view'
}

const allowed: Record<Layer, Layer[]> = {
  lib: ['lib'],
  types: [],
  asset: [],
  sim: ['sim', 'types', 'lib'],
  domain: ['domain', 'types', 'lib'],
  core: ['core', 'domain', 'types', 'lib', 'sim'],
  ui: ['ui', 'core', 'domain', 'types', 'lib'],
  view: ['view', 'ui', 'domain', 'types', 'lib', 'asset'],
}

// packages each layer may use; the views reach stores only through stores/ui, so only the app shell imports the library
const library = (pkg: string) => pkg === 'react-state-custom' || pkg === 'react-state-custom/schedulers'
const packages: Record<Layer, (pkg: string, file: string) => boolean> = {
  lib: () => false,
  types: () => false,
  asset: () => false,
  sim: () => false,
  domain: () => false,
  core: pkg => pkg === 'react' || library(pkg),
  ui: pkg => pkg === 'react' || library(pkg),
  view: (pkg, file) => pkg === 'react' || pkg === 'react-dom/client' || (path.basename(file) === 'App.tsx' && pkg.startsWith('react-state-custom')),
}

const files = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [])

const importsOf = (file: string) =>
  // `import x from '…'`, `import { a, type B } from '…'` over several lines, `export { a } from '…'`, `import '…'`
  [...fs.readFileSync(file, 'utf8').matchAll(/^(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,]+?\s+from\s+)?['"]([^'"]+)['"]/gm)].map(m => m[1]!)

it('imports only go down the layers', () => {
  const violations: string[] = []
  for (const file of files(src)) {
    const from = layerOf(file)
    for (const spec of importsOf(file)) {
      const name = path.relative(src, file)
      if (spec.startsWith('.')) {
        const to = layerOf(path.resolve(path.dirname(file), spec))
        if (!allowed[from].includes(to)) violations.push(`${name} (${from}) imports ${spec} (${to})`)
      } else if (!packages[from](spec, file)) {
        violations.push(`${name} (${from}) imports the package ${spec}`)
      }
    }
  }
  expect(violations).toEqual([])
})
