import React, { createContext, useCallback, useContext, useState } from 'react'
import { createStore as createZustandStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { atom, createStore as createJotaiStore, Provider as JotaiProvider, useAtomValue, type PrimitiveAtom } from 'jotai'
import { AutoRootCtx, createStore } from '../src'

/**
 * One "world" per library: `keys` numeric slots, a Consumer that reads one slot during render,
 * and an `update` that writes one slot from outside React. Every Consumer render bumps `renders`.
 */
export type World = {
  Providers: React.FC<{ children: React.ReactNode }>
  Consumer: React.FC<{ k: number }>
  update(k: number, value: number): void
  counter: { renders: number }
}

export type Adapter = { name: string, create(keys: number): World }

const keyName = (k: number) => `k${k}`
const initial = (keys: number) => Object.fromEntries(Array.from({ length: keys }, (_, k) => [keyName(k), 0])) as Record<string, number>

let worldId = 0

export const reactStateCustom: Adapter = {
  name: 'react-state-custom',
  create(keys) {
    const counter = { renders: 0 }
    const init = initial(keys)
    const { useStore, getStore } = createStore(`bench-${worldId++}`, () => {
      const [state, setState] = useState(init)
      const set = useCallback((k: string, v: number) => setState(s => ({ ...s, [k]: v })), [])
      return { ...state, set } as Record<string, number> & { set: (k: string, v: number) => void }
    })
    return {
      counter,
      Providers: ({ children }) => <><AutoRootCtx />{children}</>,
      Consumer: ({ k }) => { counter.renders++; return <i>{useStore()[keyName(k)]}</i> },
      update: (k, v) => getStore().get().set!(keyName(k), v),
    }
  },
}

export const zustand: Adapter = {
  name: 'zustand',
  create(keys) {
    const counter = { renders: 0 }
    const store = createZustandStore<Record<string, number>>(() => initial(keys))
    return {
      counter,
      Providers: ({ children }) => <>{children}</>,
      Consumer: ({ k }) => { counter.renders++; return <i>{useZustandStore(store, s => s[keyName(k)])}</i> },
      update: (k, v) => store.setState({ [keyName(k)]: v }),
    }
  },
}

export const jotai: Adapter = {
  name: 'jotai',
  create(keys) {
    const counter = { renders: 0 }
    const store = createJotaiStore()
    const atoms: PrimitiveAtom<number>[] = Array.from({ length: keys }, () => atom(0))
    return {
      counter,
      Providers: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>,
      Consumer: ({ k }) => { counter.renders++; return <i>{useAtomValue(atoms[k])}</i> },
      update: (k, v) => store.set(atoms[k], v),
    }
  },
}

/** Baseline: one React context holding the whole object. Every consumer re-renders on any change. */
export const reactContext: Adapter = {
  name: 'React context',
  create(keys) {
    const counter = { renders: 0 }
    const Ctx = createContext<Record<string, number>>({})
    const setter: { current: (k: string, v: number) => void } = { current: () => { } }
    return {
      counter,
      Providers: ({ children }) => {
        const [state, setState] = useState(() => initial(keys))
        setter.current = (k, v) => setState(s => ({ ...s, [k]: v }))
        return <Ctx.Provider value={state}>{children}</Ctx.Provider>
      },
      Consumer: ({ k }) => { counter.renders++; return <i>{useContext(Ctx)[keyName(k)]}</i> },
      update: (k, v) => setter.current(keyName(k), v),
    }
  },
}

export const adapters: Adapter[] = [reactStateCustom, zustand, jotai, reactContext]
