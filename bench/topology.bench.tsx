import { describe } from 'vitest'
import { topologyAdapters, MIDS, type TopologyUpdate } from './topology'
import { updateBench } from './harness'

const CONSUMERS = 1000

const scenario = (kind: TopologyUpdate, title: string) =>
  describe(`root -> ${MIDS} derived stores -> ${CONSUMERS} consumers: ${title}`, () => {
    for (const a of topologyAdapters) updateBench(a.name, a.create, CONSUMERS, MIDS, (w, tick) => w.update(kind, tick))
  })

scenario('one', 'change one threshold (1 derived store, 100 consumers affected)')
scenario('all', 'change every threshold (all affected)')
scenario('unrelated', 'change a root key no derived store reads (none affected)')
