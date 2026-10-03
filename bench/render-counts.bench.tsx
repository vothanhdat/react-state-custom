import { act } from 'react'
import { bench, describe } from 'vitest'
import { adapters } from './adapters'
import { derivedAdapters, KEYS } from './derived'
import { countUpdate, mount, unmount } from './harness'
import { codeTokens } from './loc'
import { topologyAdapters, MIDS } from './topology'
import { shopAdapters, CONSUMERS as SHOP_CONSUMERS } from './shop'
import { collectionAdapters, ITEMS } from './collection'

const CONSUMERS = 1000

/**
 * Not a timing benchmark: prints, per scenario and library, how many consumer renders and derive
 * computations one update costs, and the tokens the adapter needs. Deterministic.
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
    return [a.name, String(mountRenders), String(renders), String(codeTokens('adapters.tsx', exportName(a.name)))]
  })
  const derived = derivedAdapters.map(a => {
    const change = countUpdate(a.create, CONSUMERS, KEYS, w => w.update('change', 1))
    const balanced = countUpdate(a.create, CONSUMERS, KEYS, w => w.update('balanced', 1))
    return [a.name, cell(change), cell(balanced), String(codeTokens('derived.tsx', exportName(a.name)))]
  })
  const topology = topologyAdapters.map(a => {
    const one = countUpdate(a.create, CONSUMERS, MIDS, w => w.update('one', 1))
    const all = countUpdate(a.create, CONSUMERS, MIDS, w => w.update('all', 1))
    const unrelated = countUpdate(a.create, CONSUMERS, MIDS, w => w.update('unrelated', 1))
    return [a.name, cell(one), cell(all), cell(unrelated), String(codeTokens('topology.tsx', exportName(a.name)))]
  })
  const shop = shopAdapters.map(a => {
    const cells = (['qty', 'vat', 'theme', 'discount'] as const).map(kind => cell(countUpdate(a.create, SHOP_CONSUMERS, SHOP_CONSUMERS, w => w.update(kind, 2))))
    return [a.name, ...cells, String(codeTokens('shop.tsx', exportName(a.name)))]
  })
  const collection = collectionAdapters.map(a => {
    const { renders } = countUpdate(a.create, CONSUMERS, ITEMS, w => w.update(1))
    return [a.name, String(renders), String(codeTokens('collection.tsx', a.exportName))]
  })
  console.log([
    `## flat: ${CONSUMERS} consumers over ${KEYS} keys, 1 key changed`,
    table(['library', 'consumer renders to mount', 'consumer renders per update', 'tokens'], flat),
    `## derived: sum of ${KEYS} keys, ${CONSUMERS} consumers (renders / derive calls)`,
    table(['library', 'change one key', 'move 1 between two keys', 'tokens'], derived),
    `## topology: root -> ${MIDS} derived -> ${CONSUMERS} consumers (renders / derive calls)`,
    table(['library', 'one threshold', 'all thresholds', 'unrelated root key', 'tokens'], topology),
    `## shop: config -> items -> lines -> checkouts -> summary, ${SHOP_CONSUMERS} consumers (renders / derive calls)`,
    table(['library', 'qty of one item', 'vat', 'theme', 'discount', 'tokens'], shop),
    `## collection: ${ITEMS} items, ${CONSUMERS} consumers, one item changed`,
    table(['library', 'consumer renders per update', 'tokens'], collection),
  ].join('\n\n'))
}

const cell = (c: { renders: number, derives: number }) => `${c.renders} / ${c.derives}`
const exportName = (name: string) => ({ 'react-state-custom': 'reactStateCustom', zustand: 'zustand', jotai: 'jotai', 'React context': 'reactContext' })[name]!

describe('renders, derive calls and tokens per scenario', () => {
  let printed = false
  bench('report', () => {
    if (printed) return
    printed = true
    report()
  }, { iterations: 1, warmupIterations: 0, time: 0 })
})
