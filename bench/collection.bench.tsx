import { describe } from 'vitest'
import { collectionAdapters, ITEMS } from './collection'
import { updateBench } from './harness'

const CONSUMERS = 1000

describe(`collection: ${ITEMS} items, ${CONSUMERS} consumers, change one item (${CONSUMERS / ITEMS} affected)`, () => {
  for (const a of collectionAdapters) updateBench(a.name, a.create, CONSUMERS, ITEMS, (w, tick) => w.update(tick))
})
