import { adapters } from '../adapters'
import { derivedAdapters, KEYS } from '../derived'
import { topologyAdapters, MIDS } from '../topology'
import { shopAdapters, CONSUMERS as SHOP_CONSUMERS } from '../shop'
import { collectionAdapters, ITEMS } from '../collection'
import { nestedAdapters, expected, VIEWS, type NestedUpdate } from './nested'
import type { World } from '../harness'

/**
 * One measured case: a world, `consumers` Consumers spread over `slots` (`k = i % slots`, as in
 * the jsdom harness), and the update one step makes.
 */
export type Case = {
  id: string
  suite: 'scenarios' | 'nested'
  scenario: string
  library: string
  consumers: number
  slots: number
  create(): World
  step(world: any, tick: number): void
  /** What each consumer shows after `ticks` steps. Without it, the runner checks that every library shows the same. */
  expected?(ticks: number): number[]
}

export const cases: Case[] = []
const add = (scenario: string, list: { name: string }[], c: Omit<Case, 'id' | 'suite' | 'scenario' | 'library' | 'consumers' | 'create'> & { create(a: any): World }) => {
  for (const a of list) cases.push({ id: `${scenario} | ${a.name}`, suite: 'scenarios', scenario, library: a.name, consumers: 1000, ...c, create: () => c.create(a) })
}

// The scenarios of the jsdom suite (bench/*.bench.tsx), with the same adapters, sizes and updates.
add('flat: update 1 key, 100 of 1000 consumers affected', adapters, { slots: 10, create: a => a.create(10), step: (w, t) => w.update(t % 10, t) })
add('flat: update 1 key, all 1000 consumers affected', adapters, { slots: 1, create: a => a.create(1), step: (w, t) => w.update(0, t) })
add('derived: change one key (sum changes)', derivedAdapters, { slots: KEYS, create: a => a.create(), step: (w, t) => w.update('change', t) })
add('derived: move 1 between two keys (sum unchanged)', derivedAdapters, { slots: KEYS, create: a => a.create(), step: (w, t) => w.update('balanced', t) })
add('topology: one threshold (100 affected)', topologyAdapters, { slots: MIDS, create: a => a.create(), step: (w, t) => w.update('one', t) })
add('topology: all thresholds (1000 affected)', topologyAdapters, { slots: MIDS, create: a => a.create(), step: (w, t) => w.update('all', t) })
add('topology: unrelated root key (none affected)', topologyAdapters, { slots: MIDS, create: a => a.create(), step: (w, t) => w.update('unrelated', t) })
add('shop: qty of one item (235 affected)', shopAdapters, { slots: SHOP_CONSUMERS, create: a => a.create(), step: (w, t) => w.update('qty', t) })
add('shop: vat (500 affected)', shopAdapters, { slots: SHOP_CONSUMERS, create: a => a.create(), step: (w, t) => w.update('vat', t) })
add('shop: theme (none affected)', shopAdapters, { slots: SHOP_CONSUMERS, create: a => a.create(), step: (w, t) => w.update('theme', t) })
add('shop: discount (1000 affected)', shopAdapters, { slots: SHOP_CONSUMERS, create: a => a.create(), step: (w, t) => w.update('discount', t) })
add(`collection: one of ${ITEMS} items, 5 of 1000 consumers affected`, collectionAdapters, { slots: ITEMS, create: a => a.create(), step: (w, t) => w.update(t) })

// The nested scenario (nested.tsx), checked against its reference values.
const nestedUpdates: NestedUpdate[] = ['one-field', 'ten-fields', 'output-unchanged', 'unread-field']
for (const kind of nestedUpdates) for (const a of nestedAdapters) {
  cases.push({
    id: `nested: ${kind} | ${a.name}`, suite: 'nested', scenario: `nested: ${kind}`, library: a.name,
    consumers: VIEWS, slots: VIEWS, create: () => a.create(kind), step: w => w.update(), expected: ticks => expected(kind, ticks),
  })
}
