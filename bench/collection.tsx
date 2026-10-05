import React, { createContext, useContext, useState } from 'react'
import { createStore as createZustandStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { atom, createStore as createJotaiStore, Provider as JotaiProvider, useAtomValue, type PrimitiveAtom } from 'jotai'
import { AutoRootCtx, createStore } from '../src'
import type { World } from './harness'

/**
 * Collection scenario: ITEMS numeric items, 5 consumers per item, one item changed per update.
 * `react-state-custom` appears twice: with the items spread as top-level store keys (the pattern the
 * docs recommend, each key tracked separately) and with the whole array under one `items` key (the
 * proxy tracks top-level keys only, so every consumer re-renders).
 */
export const ITEMS = 200
export type CollectionWorld = World & { update(tick: number): void }
export type CollectionAdapter = { name: string, exportName: string, create(): CollectionWorld }

const itemId = (i: number) => `item${i}`
const initial = () => Object.fromEntries(Array.from({ length: ITEMS }, (_, i) => [itemId(i), 0])) as Record<string, number>

let worldId = 0

export const reactStateCustom: CollectionAdapter = {
  name: 'react-state-custom',
  exportName: 'reactStateCustom',
  create() {
    const counters = { renders: 0, derives: 0 }
    const items = createStore(`collection-flat-${worldId++}`, () => {
      const [state, setState] = useState(initial)
      const set = (id: string, v: number) => setState(s => ({ ...s, [id]: v }))
      return { ...state, set } as Record<string, number> & { set: typeof set }
    })
    return {
      counters,
      Providers: ({ children }) => <><AutoRootCtx />{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{items.useStore()[itemId(k)]}</i> },
      update: tick => items.storeRef().get().set!(itemId(tick % ITEMS), tick),
    }
  },
}

export const reactStateCustomArray: CollectionAdapter = {
  name: 'react-state-custom, array in one key',
  exportName: 'reactStateCustomArray',
  create() {
    const counters = { renders: 0, derives: 0 }
    const list = createStore(`collection-array-${worldId++}`, () => {
      const [items, setItems] = useState(() => Array.from({ length: ITEMS }, () => 0))
      return { items, set: (i: number, v: number) => setItems(s => s.map((x, j) => j === i ? v : x)) }
    })
    return {
      counters,
      Providers: ({ children }) => <><AutoRootCtx />{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{list.useStore().items?.[k]}</i> },
      update: tick => list.storeRef().get().set!(tick % ITEMS, tick),
    }
  },
}

export const zustand: CollectionAdapter = {
  name: 'zustand',
  exportName: 'zustand',
  create() {
    const counters = { renders: 0, derives: 0 }
    const store = createZustandStore<{ items: Record<string, number> }>(() => ({ items: initial() }))
    return {
      counters,
      Providers: ({ children }) => <>{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useZustandStore(store, s => s.items[itemId(k)])}</i> },
      update: tick => store.setState(s => ({ items: { ...s.items, [itemId(tick % ITEMS)]: tick } })),
    }
  },
}

/** One primitive atom per item, the Jotai shape for a collection of independently changing items. */
export const jotai: CollectionAdapter = {
  name: 'jotai',
  exportName: 'jotai',
  create() {
    const counters = { renders: 0, derives: 0 }
    const store = createJotaiStore()
    const itemAtoms: PrimitiveAtom<number>[] = Array.from({ length: ITEMS }, () => atom(0))
    return {
      counters,
      Providers: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useAtomValue(itemAtoms[k])}</i> },
      update: tick => store.set(itemAtoms[tick % ITEMS], tick),
    }
  },
}

export const reactContext: CollectionAdapter = {
  name: 'React context',
  exportName: 'reactContext',
  create() {
    const counters = { renders: 0, derives: 0 }
    const Ctx = createContext<Record<string, number>>({})
    const setter: { current: (id: string, v: number) => void } = { current: () => { } }
    return {
      counters,
      Providers: ({ children }) => {
        const [state, setState] = useState(initial)
        setter.current = (id, v) => setState(s => ({ ...s, [id]: v }))
        return <Ctx.Provider value={state}>{children}</Ctx.Provider>
      },
      Consumer: ({ k }) => { counters.renders++; return <i>{useContext(Ctx)[itemId(k)]}</i> },
      update: tick => setter.current(itemId(tick % ITEMS), tick),
    }
  },
}

export const collectionAdapters: CollectionAdapter[] = [reactStateCustom, reactStateCustomArray, zustand, jotai, reactContext]
