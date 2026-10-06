// Type-checks the ts/tsx code blocks of the docs and the README against the library's source, so an example
// that uses an API wrongly (an export that does not exist, an unknown option, a wrong argument) fails CI.
// A block is a sketch, not a program: names it uses without declaring them (`socket`, `fetchUser`, the
// store of an earlier block) are allowed, as are blocks that do not parse on their own (a signature, a
// body without its function). Everything else TypeScript reports is an error.
//
//   yarn test:docs-code
//
// A block that is wrong on purpose goes after a `<!-- docs-code: skip -->` line.
import ts from 'typescript'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

/** The package's entries, as the docs import them, mapped to the source they are built from. */
const entries = {
  'react-state-custom': 'src/index.ts',
  'react-state-custom/schedulers': 'src/schedulers/index.ts',
  'react-state-custom/testing': 'src/testing/index.ts',
  'react-state-custom/dev-tool': 'src/dev-tool/index.ts',
  'react-state-custom/dev-tool/obj-view': 'src/dev-tool/obj-view.tsx',
}
const { exports } = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'))
const unmapped = Object.keys(exports)
  .filter(path => !/\.(css|json)$/.test(path))
  .map(path => path === '.' ? 'react-state-custom' : 'react-state-custom/' + path.slice(2))
  .filter(name => !entries[name])
if (unmapped.length) throw Error(`tests/docs-code/check.mjs: map ${unmapped.join(', ')} to its source in \`entries\``)

/** What a sketch may leave out: a declaration, a module of the reader's app, a type annotation. */
const SKETCH = new Set([
  2304, // Cannot find name
  2552, // Cannot find name, did you mean
  2503, // Cannot find namespace
  2582, 2593, // Cannot find name 'describe' / 'it' (test runner globals)
  18004, // No value exists in scope for the shorthand property
  2391, // Function implementation is missing (a signature)
  2440, // Import declaration conflicts with local declaration (a signature under its import)
  2451, // Cannot redeclare block-scoped variable (two versions of the same code in one block)
  1108, // A 'return' statement can only be used within a function body
  7006, 7031, // Parameter / binding element implicitly has an 'any' type
])
/** Names a page imports once for all its blocks, where a DOM global would stand in for them otherwise. */
const pageImports = { screen: `import { screen } from '@testing-library/react'` }
const outsideTheLibrary = d => d.code === 2307 && !/['"]react-state-custom[/'"]/.test(ts.flattenDiagnosticMessageText(d.messageText, '\n'))

// every ```ts / ```tsx block, as its own module
const pages = [join(repo, 'README.md')]
const walk = dir => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    if (e.isDirectory()) walk(join(dir, e.name))
    else if (e.name.endsWith('.md')) pages.push(join(dir, e.name))
  }
}
walk(join(repo, 'docs'))

const blocks = new Map() // virtual file -> { page, line, text }
for (const page of pages) {
  const lines = readFileSync(page, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!/^```tsx?\b/.test(lines[i])) continue
    const above = lines.slice(Math.max(0, i - 2), i).map(line => line.trim()).filter(Boolean)
    const skip = above.at(-1) === '<!-- docs-code: skip -->'
    const start = i + 1
    while (i + 1 < lines.length && !lines[++i].startsWith('```'));
    if (skip) continue
    let text = lines.slice(start, i).join('\n')
    // appended, not prepended, so the block's line numbers stay those of the page
    for (const [name, statement] of Object.entries(pageImports)) {
      if (new RegExp(`\\b${name}\\.`).test(text) && !new RegExp(`import [^;]*\\b${name}\\b`).test(text)) text += '\n' + statement
    }
    const file = join(repo, 'tests/docs-code/blocks', `${relative(repo, page).replace(/[/.]/g, '_')}_${start}.tsx`)
    blocks.set(file, { page: relative(repo, page), line: start + 1, text: text + '\nexport {}\n' })
  }
}

const options = {
  strict: true, noEmit: true, skipLibCheck: true, jsx: ts.JsxEmit.ReactJSX,
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  types: ['node', 'vite/client'], baseUrl: repo,
  paths: Object.fromEntries(Object.entries(entries).map(([name, file]) => [name, [file]])),
}
// the blocks exist in memory only, next to the repo's node_modules
const host = ts.createCompilerHost(options)
const { fileExists, readFile, getSourceFile } = host
host.fileExists = file => blocks.has(file) || fileExists(file)
host.readFile = file => blocks.get(file)?.text ?? readFile(file)
host.getSourceFile = (file, version, ...rest) => blocks.has(file)
  ? ts.createSourceFile(file, blocks.get(file).text, version, true, ts.ScriptKind.TSX)
  : getSourceFile(file, version, ...rest)
const program = ts.createProgram([...blocks.keys()], options, host)

let fragments = 0
const errors = []
for (const [file, block] of blocks) {
  const source = program.getSourceFile(file)
  if (program.getSyntacticDiagnostics(source).length) { fragments++; continue }
  for (const d of program.getSemanticDiagnostics(source)) {
    if (SKETCH.has(d.code) || outsideTheLibrary(d)) continue
    const { line } = source.getLineAndCharacterOfPosition(d.start ?? 0)
    errors.push(`${block.page}:${block.line + line}  TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n  ')}`)
  }
}

console.log(`${blocks.size} code blocks: ${blocks.size - fragments} checked, ${fragments} fragments that do not parse on their own`)
if (errors.length) {
  console.error(`\n${errors.length} error${errors.length > 1 ? 's' : ''}:\n` + errors.join('\n'))
  process.exit(1)
}
