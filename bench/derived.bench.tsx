import { describe } from 'vitest'
import { derivedAdapters, KEYS, type DerivedUpdate } from './derived'
import { updateBench } from './harness'

const CONSUMERS = 1000

const scenario = (kind: DerivedUpdate, title: string) =>
  describe(`derived sum of ${KEYS} keys, ${CONSUMERS} consumers: ${title}`, () => {
    for (const a of derivedAdapters) updateBench(a.name, a.create, CONSUMERS, KEYS, (w, tick) => w.update(kind, tick))
  })

scenario('change', 'change one key (sum changes, all consumers affected)')
scenario('balanced', 'move 1 between two keys (sum unchanged, none affected)')
