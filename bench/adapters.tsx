import React, { createContext, useContext, useState } from 'react'
import { createStore as createZustandStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { atom, createStore as createJotaiStore, Provider as JotaiProvider, useAtomValue, type PrimitiveAtom } from 'jotai'
import { AutoRootCtx, createStore } from '../src'
import type { World } from './harness'

/**
 * Flat scenario, one "world" per library: `keys` numeric slots, a Consumer that reads one slot
 * during render, and an `update` that writes one slot from outside React.
 */
export type FlatWorld = World & { update(k: number, value: number): void }

export type Adapter = { name: string, create(keys: number): FlatWorld }

const keyName = (k: number) => `k${k}`
const initial = (keys: number) => Object.fromEntries(Array.from({ length: keys }, (_, k) => [keyName(k), 0])) as Record<string, number>

let worldId = 0

export const reactStateCustom: Adapter = {
  name: 'react-state-custom',
  create(keys) {
    const counters = { renders: 0, derives: 0 }
    const init = initial(keys)
    const { useStore, getStore } = createStore(`bench-${worldId++}`, () => {
      const [state, setState] = useState(init)
      const set = (k: string, v: number) => setState(s => ({ ...s, [k]: v }))
      return { ...state, set } as Record<string, number> & { set: typeof set }
    })
    return {
      counters,
      Providers: ({ children }) => <><AutoRootCtx />{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useStore()[keyName(k)]}</i> },
      update: (k, v) => getStore().get().set!(keyName(k), v),
    }
  },
}

export const zustand: Adapter = {
  name: 'zustand',
  create(keys) {
    const counters = { renders: 0, derives: 0 }
    const store = createZustandStore<Record<string, number>>(() => initial(keys))
    return {
      counters,
      Providers: ({ children }) => <>{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useZustandStore(store, s => s[keyName(k)])}</i> },
      update: (k, v) => store.setState({ [keyName(k)]: v }),
    }
  },
}

export const jotai: Adapter = {
  name: 'jotai',
  create(keys) {
    const counters = { renders: 0, derives: 0 }
    const store = createJotaiStore()
    const atoms: PrimitiveAtom<number>[] = Array.from({ length: keys }, () => atom(0))
    return {
      counters,
      Providers: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useAtomValue(atoms[k])}</i> },
      update: (k, v) => store.set(atoms[k], v),
    }
  },
}

/** Baseline: one React context holding the whole object. Every consumer re-renders on any change. */
export const reactContext: Adapter = {
  name: 'React context',
  create(keys) {
    const counters = { renders: 0, derives: 0 }
    const Ctx = createContext<Record<string, number>>({})
    const setter: { current: (k: string, v: number) => void } = { current: () => { } }
    return {
      counters,
      Providers: ({ children }) => {
        const [state, setState] = useState(() => initial(keys))
        setter.current = (k, v) => setState(s => ({ ...s, [k]: v }))
        return <Ctx.Provider value={state}>{children}</Ctx.Provider>
      },
      Consumer: ({ k }) => { counters.renders++; return <i>{useContext(Ctx)[keyName(k)]}</i> },
      update: (k, v) => setter.current(keyName(k), v),
    }
  },
}

export const adapters: Adapter[] = [reactStateCustom, zustand, jotai, reactContext]
