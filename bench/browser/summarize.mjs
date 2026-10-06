// Prints the tables of bench/README.md from a results file.
//   node bench/browser/summarize.mjs [bench/browser/results.json]
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const LIBRARIES = ['react-state-custom', 'zustand', 'jotai', 'React context']
/** Other react-state-custom adapters of a scenario, each printed as a row of its own under it. */
const VARIANTS = [
  { library: 'react-state-custom, array in one key', row: s => `${s.split(':')[0]}: same, array under one key` },
  { library: 'react-state-custom, store per line', row: s => `${s.replace(/ \(.*\)$/, '')}, store per line` },
]

const median = list => {
  const sorted = [...list].sort((a, b) => a - b)
  const mid = sorted.length / 2
  return sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
}
const ms = v => v === undefined ? '' : v < 0.1 ? v.toFixed(3) : v < 10 ? v.toFixed(2) : v.toFixed(1)
const count = v => Number.isInteger(v) ? String(v) : v.toFixed(1)

/** Pool every round's samples of a case and take the median; counters are the same in every round. */
const byCase = runs => {
  const cases = new Map()
  for (const run of runs) {
    const c = cases.get(run.id) ?? { ...run, samples: [] }
    c.samples.push(...run.samples)
    cases.set(run.id, c)
  }
  return [...cases.values()].map(c => ({ ...c, median: median(c.samples) }))
}

export function summarize(data) {
  const cases = byCase(data.runs)
  const find = (scenario, library) => cases.find(c => c.scenario === scenario && c.library === library)
  const scenarios = suite => [...new Set(cases.filter(c => c.suite === suite).map(c => c.scenario))]
  const lines = []

  lines.push('| scenario | ' + LIBRARIES.join(' | ') + ' |', '|---|' + LIBRARIES.map(() => '---').join('|') + '|')
  for (const s of scenarios('scenarios')) {
    lines.push(`| ${s} | ${LIBRARIES.map(l => ms(find(s, l)?.median)).join(' | ')} |`)
    for (const v of VARIANTS) {
      const variant = find(s, v.library)
      if (variant) lines.push(`| ${v.row(s)} | ${ms(variant.median)} | | | |`)
    }
  }

  const nested = scenarios('nested')
  const adapters = [...new Set(cases.filter(c => c.suite === 'nested').map(c => c.library))]
  const head = '| | ' + nested.map(s => s.replace('nested: ', '')).join(' | ') + ' |'
  const rule = '|---|' + nested.map(() => '---:').join('|') + '|'
  lines.push('', 'Median ms per update:', '', head, rule)
  for (const a of adapters) lines.push(`| ${a} | ${nested.map(s => ms(find(s, a)?.median)).join(' | ')} |`)
  lines.push('', 'View renders per update:', '', head, rule)
  for (const a of adapters) lines.push(`| ${a} | ${nested.map(s => count(find(s, a)?.perUpdate.renders ?? 0)).join(' | ')} |`)
  return lines.join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), 'results.json')
  console.log(summarize(JSON.parse(await fs.readFile(file, 'utf8'))))
}
