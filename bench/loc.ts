import { readFileSync } from 'fs'
import { resolve } from 'path'

/**
 * Non-blank, non-comment lines of one `export const <name>: … = {` block in a bench adapter file,
 * from that line to the first line that is exactly `}`. Printed next to the render counts so the
 * code each library needs for a scenario is measured, not estimated.
 */
export const linesOfCode = (file: string, exportName: string): number => {
  const lines = readFileSync(resolve(__dirname, file), 'utf8').split('\n')
  const start = lines.findIndex(l => l.startsWith(`export const ${exportName}`))
  if (start < 0) throw new Error(`${exportName} not found in ${file}`)
  const end = lines.findIndex((l, i) => i > start && l === '}')
  return lines.slice(start, end + 1).filter(l => l.trim() !== '' && !l.trim().startsWith('//') && !l.trim().startsWith('/*') && !l.trim().startsWith('*')).length
}
