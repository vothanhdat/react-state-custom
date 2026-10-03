import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { bench } from 'vitest'

// React's act() needs this flag; set it before any render.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

export type Counters = { renders: number, derives: number }

/** What every scenario adapter builds: providers, a consumer per slot `k`, and counters. */
export type World = {
  Providers: React.FC<{ children: React.ReactNode }>
  Consumer: React.FC<{ k: number }>
  counters: Counters
}

export type Mounted<W extends World> = { world: W, root: Root, container: HTMLElement }

/** Mount `consumers` Consumers spread over `keys` slots and wait for the first data to arrive. */
export const mount = <W extends World>(create: () => W, consumers: number, keys: number): Mounted<W> => {
  const world = create()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const { Providers, Consumer } = world
  act(() => {
    root.render(<Providers>{Array.from({ length: consumers }, (_, i) => <Consumer key={i} k={i % keys} />)}</Providers>)
  })
  return { world, root, container }
}

export const unmount = ({ root, container }: Mounted<World>) => {
  act(() => { root.unmount() })
  container.remove()
}

/**
 * Time one update (plus every re-render it causes) on a mounted world.
 * vitest runs no beforeAll/afterAll hooks in bench mode, so each bench mounts lazily on its first
 * call and unmounts in tinybench's teardown after the measured run.
 */
export const updateBench = <W extends World>(
  name: string,
  create: () => W,
  consumers: number,
  keys: number,
  step: (world: W, tick: number) => void,
) => {
  let m: Mounted<W> | undefined
  let tick = 0
  bench(name, () => {
    m ??= mount(create, consumers, keys)
    act(() => { step(m!.world, ++tick) })
  }, {
    warmupIterations: 20,
    iterations: 200,
    time: 0,
    teardown: (_task, mode) => { if (mode === 'run' && m) { unmount(m); m = undefined } },
  })
}

/** Mount, run one update, report consumer renders and derive calls it caused, unmount. */
export const countUpdate = <W extends World>(create: () => W, consumers: number, keys: number, step: (world: W) => void): Counters => {
  const m = mount(create, consumers, keys)
  m.world.counters.renders = 0
  m.world.counters.derives = 0
  act(() => { step(m.world) })
  const result = { ...m.world.counters }
  unmount(m)
  return result
}
