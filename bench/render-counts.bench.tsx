import { act } from 'react'
import { bench, describe } from 'vitest'
import { adapters } from './adapters'
import { derivedAdapters, KEYS } from './derived'
import { countUpdate, mount, unmount } from './harness'
import { linesOfCode } from './loc'
import { topologyAdapters, MIDS } from './topology'

const CONSUMERS = 1000

/**
 * Not a timing benchmark: prints, per scenario and library, how many consumer renders and derive
 * computations one update costs, and the lines of code the adapter needs. Deterministic.
 */
const table = (header: string[], rows: string[][]) =>
  [`| ${header.join(' | ')} |`, `|${header.map(() => '---').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)].join('\n')

const report = () => {
  const flat = adapters.map(a => {
    const m = mount(() => a.create(KEYS), CONSUMERS, KEYS)
    const mountRenders = m.world.counters.renders
    m.world.counters.renders = 0
    act(() => { m.world.update(3, 1) })
    const renders = m.world.counters.renders
    unmount(m)
    return [a.name, String(mountRenders), String(renders), String(linesOfCode('adapters.tsx', exportName(a.name)))]
  })
  const derived = derivedAdapters.map(a => {
    const change = countUpdate(a.create, CONSUMERS, KEYS, w => w.update('change', 1))
    const balanced = countUpdate(a.create, CONSUMERS, KEYS, w => w.update('balanced', 1))
    return [a.name, cell(change), cell(balanced), String(linesOfCode('derived.tsx', exportName(a.name)))]
  })
  const topology = topologyAdapters.map(a => {
    const one = countUpdate(a.create, CONSUMERS, MIDS, w => w.update('one', 1))
    const all = countUpdate(a.create, CONSUMERS, MIDS, w => w.update('all', 1))
    const unrelated = countUpdate(a.create, CONSUMERS, MIDS, w => w.update('unrelated', 1))
    return [a.name, cell(one), cell(all), cell(unrelated), String(linesOfCode('topology.tsx', exportName(a.name)))]
  })
  console.log([
    `## flat: ${CONSUMERS} consumers over ${KEYS} keys, 1 key changed`,
    table(['library', 'consumer renders to mount', 'consumer renders per update', 'lines of code'], flat),
    `## derived: sum of ${KEYS} keys, ${CONSUMERS} consumers (renders / derive calls)`,
    table(['library', 'change one key', 'move 1 between two keys', 'lines of code'], derived),
    `## topology: root -> ${MIDS} derived -> ${CONSUMERS} consumers (renders / derive calls)`,
    table(['library', 'one threshold', 'all thresholds', 'unrelated root key', 'lines of code'], topology),
  ].join('\n\n'))
}

const cell = (c: { renders: number, derives: number }) => `${c.renders} / ${c.derives}`
const exportName = (name: string) => ({ 'react-state-custom': 'reactStateCustom', zustand: 'zustand', jotai: 'jotai', 'React context': 'reactContext' })[name]!

describe('renders, derive calls and lines of code per scenario', () => {
  let printed = false
  bench('report', () => {
    if (printed) return
    printed = true
    report()
  }, { iterations: 1, warmupIterations: 0, time: 0 })
})
