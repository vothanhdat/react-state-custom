import { bench, describe } from 'vitest'
import { adapters } from './adapters'
import { mount, unmount, updateBench } from './harness'

const CONSUMERS = 1000
const KEYS = 10

describe(`update one key: ${CONSUMERS} consumers over ${KEYS} keys (${CONSUMERS / KEYS} affected)`, () => {
  for (const a of adapters) updateBench(a.name, () => a.create(KEYS), CONSUMERS, KEYS, (w, tick) => w.update(tick % KEYS, tick))
})

describe(`update one key: ${CONSUMERS} consumers all on that key (${CONSUMERS} affected)`, () => {
  for (const a of adapters) updateBench(a.name, () => a.create(1), CONSUMERS, 1, (w, tick) => w.update(0, tick))
})

describe(`mount and unmount ${CONSUMERS} consumers over ${KEYS} keys`, () => {
  for (const a of adapters) {
    bench(a.name, () => {
      unmount(mount(() => a.create(KEYS), CONSUMERS, KEYS))
    }, { warmupIterations: 3, iterations: 20, time: 0 })
  }
})
