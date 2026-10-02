import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { bench, describe } from 'vitest'
import { adapters, type Adapter, type World } from './adapters'

// React's act() needs this flag; set it before any render.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

const CONSUMERS = 1000
const KEYS = 10

type Mounted = { world: World, root: Root, container: HTMLElement }

/** Mount `consumers` Consumers spread over `keys` slots and wait for the first data to arrive. */
const mount = (adapter: Adapter, consumers: number, keys: number): Mounted => {
  const world = adapter.create(keys)
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const { Providers, Consumer } = world
  act(() => {
    root.render(<Providers>{Array.from({ length: consumers }, (_, i) => <Consumer key={i} k={i % keys} />)}</Providers>)
  })
  return { world, root, container }
}

const unmount = ({ root, container }: Mounted) => {
  act(() => { root.unmount() })
  container.remove()
}

/**
 * vitest runs no beforeAll/afterAll hooks in bench mode, so each bench mounts lazily on its first
 * call and unmounts in tinybench's teardown after the measured run.
 */
const updateBench = (adapter: Adapter, consumers: number, keys: number) => {
  let m: Mounted | undefined
  let tick = 0
  bench(adapter.name, () => {
    m ??= mount(adapter, consumers, keys)
    const world = m.world
    act(() => { world.update(tick % keys, ++tick) })
  }, {
    warmupIterations: 20,
    iterations: 200,
    time: 0,
    teardown: (_task, mode) => { if (mode === 'run' && m) { unmount(m); m = undefined } },
  })
}

describe(`update one key: ${CONSUMERS} consumers over ${KEYS} keys (${CONSUMERS / KEYS} affected)`, () => {
  for (const adapter of adapters) updateBench(adapter, CONSUMERS, KEYS)
})

describe(`update one key: ${CONSUMERS} consumers all on that key (${CONSUMERS} affected)`, () => {
  for (const adapter of adapters) updateBench(adapter, CONSUMERS, 1)
})

describe(`mount and unmount ${CONSUMERS} consumers over ${KEYS} keys`, () => {
  for (const adapter of adapters) {
    bench(adapter.name, () => {
      unmount(mount(adapter, CONSUMERS, KEYS))
    }, { warmupIterations: 3, iterations: 20, time: 0 })
  }
})
