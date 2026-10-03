import { readFileSync } from 'fs'
import { resolve } from 'path'
import ts from 'typescript'

/**
 * Code size of one `export const <name>: … = {` block in a bench adapter file, from that line to the
 * first line that is exactly `}`, as the number of TypeScript tokens (whitespace and comments
 * excluded). Printed next to the render counts so the code each library needs for a scenario is
 * measured, not estimated, and independent of how lines are wrapped.
 */
export const codeTokens = (file: string, exportName: string): number => {
  const lines = readFileSync(resolve(__dirname, file), 'utf8').split('\n')
  const start = lines.findIndex(l => l.startsWith(`export const ${exportName}`))
  if (start < 0) throw new Error(`${exportName} not found in ${file}`)
  const end = lines.findIndex((l, i) => i > start && l === '}')
  const source = ts.createSourceFile('adapter.tsx', lines.slice(start, end + 1).join('\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let count = 0
  const visit = (node: ts.Node) => {
    const children = node.getChildren(source)
    if (children.length === 0) { if (node.kind !== ts.SyntaxKind.EndOfFileToken && node.kind !== ts.SyntaxKind.SyntaxList) count++ }
    else children.forEach(visit)
  }
  visit(source)
  return count
}
