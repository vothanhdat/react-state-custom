import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { bench, describe } from 'vitest'
import { AutoRootCtx, createStore } from '../src'

// React's act() needs this flag; set it before any render.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true

/**
 * Scale: react-state-custom alone, no comparison. The costs that grow with the number of keys of a
 * store or with the number of instances: one update changing every key of a keyed collection, a
 * component reading every key, thousands of instances starting at once.
 */
const KEYS = 4000
const INSTANCES = 5000
const ids = Array.from({ length: KEYS }, (_, i) => `item${i}`)

let storeId = 0

/** A keyed collection where one `setTick` changes every item. */
const collection = () => {
  const { useStore: useItems, storeRef: getItems } = createStore(`scale-items-${storeId++}`, () => {
    const [tick, setTick] = useState(0)
    const items: Record<string, number> = {}
    for (const id of ids) items[id] = tick
    return { ...items, setTick } as Record<string, number> & { setTick: (tick: number) => void }
  })
  // the list of ids: re-renders only when an item is added or removed
  const List = () => <b>{Object.keys(useItems()).filter(id => id !== 'setTick').length}</b>
  // reads every item: one useStore call, then plain reads
  const Total = () => {
    const items = useItems()
    let total = 0
    for (const id of ids) total += items[id] ?? 0
    return <b>{total}</b>
  }
  return { getItems, List, Total }
}

const render = (node: React.ReactNode) => {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(node) })
  return () => { act(() => { root.unmount() }); container.remove() }
}

/** Lazy mount on the first call, unmount in teardown: vitest runs no beforeAll in bench mode. */
const updateBench = (name: string, setup: () => { step: (tick: number) => void, stop: () => void }) => {
  let world: ReturnType<typeof setup> | undefined
  let tick = 0
  bench(name, () => {
    world ??= setup()
    act(() => { world!.step(++tick) })
  }, {
    warmupIterations: 5,
    iterations: 50,
    time: 0,
    teardown: (_task, mode) => { if (mode === 'run' && world) { world.stop(); world = undefined } },
  })
}

describe(`scale: ${KEYS} keys in one store, every key changes in one update`, () => {
  updateBench('a component listing the keys', () => {
    const { getItems, List } = collection()
    const stop = render(<><AutoRootCtx /><List /></>)
    return { step: tick => getItems().get().setTick?.(tick), stop }
  })
  updateBench('a component reading every key', () => {
    const { getItems, Total } = collection()
    const stop = render(<><AutoRootCtx /><Total /></>)
    return { step: tick => getItems().get().setTick?.(tick), stop }
  })
  updateBench('one storeRef().subscribe listener', () => {
    const { getItems } = collection()
    const release = getItems().retain()
    const unsubscribe = getItems().subscribe(() => { })
    const stop = render(<AutoRootCtx />)
    return { step: tick => getItems().get().setTick?.(tick), stop: () => { act(() => { unsubscribe(); release() }); stop() } }
  })
})

describe('scale: mounting', () => {
  // the store runs before the first iteration: each one times Total mounting, then unmounting
  let world: { show: (on: boolean) => void, stop: () => void } | undefined
  bench(`a component reading all ${KEYS} keys of a running store, mount and unmount`, () => {
    world ??= (() => {
      const { getItems, Total } = collection()
      let show = (_: boolean) => { }
      const App = () => {
        const [on, setOn] = useState(false)
        show = setOn
        return <><AutoRootCtx />{on && <Total />}</>
      }
      const release = getItems().retain()
      const stop = render(<App />)
      return { show: on => show(on), stop: () => { act(() => { release() }); stop() } }
    })()
    act(() => { world!.show(true) })
    act(() => { world!.show(false) })
  }, {
    warmupIterations: 2,
    iterations: 20,
    time: 0,
    teardown: (_task, mode) => { if (mode === 'run' && world) { world.stop(); world = undefined } },
  })

  bench(`${INSTANCES} instances start at once, mount and unmount`, () => {
    // a fresh store per run, so no run finds contexts an earlier one left cached
    const { useStore: useRow } = createStore(`scale-rows-${storeId++}`, ({ id }: { id: number }) => {
      const [value] = useState(id)
      return { value }
    })
    const Row = ({ id }: { id: number }) => <i>{useRow({ id }).value}</i>
    const stop = render(<><AutoRootCtx />{Array.from({ length: INSTANCES }, (_, id) => <Row key={id} id={id} />)}</>)
    stop()
  }, { warmupIterations: 2, iterations: 20, time: 0 })
})
