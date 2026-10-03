import React, { createContext, useContext, useMemo, useState } from 'react'
import { createStore as createZustandStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { atom, createStore as createJotaiStore, Provider as JotaiProvider, useAtomValue } from 'jotai'
import { AutoRootCtx, createStore } from '../src'
import type { World } from './harness'

/**
 * Derived-state scenario: a base store with KEYS numeric slots and a summary derived from all of
 * them. Every consumer reads `sum`. Two updates: `change` alters one slot (sum changes, every
 * consumer must re-render) and `balanced` moves 1 from one slot to another in a single update
 * (sum unchanged, nothing should re-render). `derives` counts summary computations.
 */
export const KEYS = 10
export type DerivedUpdate = 'change' | 'balanced'
export type DerivedWorld = World & { update(kind: DerivedUpdate, tick: number): void }
export type DerivedAdapter = { name: string, create(): DerivedWorld }

type Base = Record<string, number>
const keyName = (k: number) => `k${k}`
const initial = () => Object.fromEntries(Array.from({ length: KEYS }, (_, k) => [keyName(k), 0])) as Base
const sumOf = (base: Partial<Base>) => Array.from({ length: KEYS }, (_, k) => base[keyName(k)] ?? 0).reduce((a, b) => a + b, 0)
const patchFor = (kind: DerivedUpdate, tick: number, base: Partial<Base>): Base =>
  kind === 'change' ? { [keyName(tick % KEYS)]: tick } : { k0: (base.k0 ?? 0) + 1, k1: (base.k1 ?? 0) - 1 }

let worldId = 0

export const reactStateCustom: DerivedAdapter = {
  name: 'react-state-custom',
  create() {
    const counters = { renders: 0, derives: 0 }
    const base = createStore(`bench-derived-base-${worldId++}`, () => {
      const [state, setState] = useState(initial)
      const patch = (p: Base) => setState(s => ({ ...s, ...p }))
      return { ...state, patch } as Base & { patch: typeof patch }
    })
    const summary = createStore(`bench-derived-summary-${worldId++}`, () => {
      const data = base.useStore()
      counters.derives++
      return { sum: sumOf(data) }
    })
    return {
      counters,
      Providers: ({ children }) => <><AutoRootCtx />{children}</>,
      Consumer: () => { counters.renders++; return <i>{summary.useStore().sum}</i> },
      update: (kind, tick) => { const s = base.getStore().get(); s.patch!(patchFor(kind, tick, s)) },
    }
  },
}

export const zustand: DerivedAdapter = {
  name: 'zustand',
  create() {
    const counters = { renders: 0, derives: 0 }
    const store = createZustandStore<Base>(initial)
    const selectSum = (s: Base) => { counters.derives++; return sumOf(s) }
    return {
      counters,
      Providers: ({ children }) => <>{children}</>,
      Consumer: () => { counters.renders++; return <i>{useZustandStore(store, selectSum)}</i> },
      update: (kind, tick) => store.setState(patchFor(kind, tick, store.getState())),
    }
  },
}

export const jotai: DerivedAdapter = {
  name: 'jotai',
  create() {
    const counters = { renders: 0, derives: 0 }
    const store = createJotaiStore()
    const baseAtom = atom(initial())
    const sumAtom = atom(get => { counters.derives++; return sumOf(get(baseAtom)) })
    return {
      counters,
      Providers: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>,
      Consumer: () => { counters.renders++; return <i>{useAtomValue(sumAtom)}</i> },
      update: (kind, tick) => store.set(baseAtom, s => ({ ...s, ...patchFor(kind, tick, s) })),
    }
  },
}

/** Baseline: the base object in a React context, the sum derived with useMemo in each consumer. */
export const reactContext: DerivedAdapter = {
  name: 'React context',
  create() {
    const counters = { renders: 0, derives: 0 }
    const Ctx = createContext<Base>({})
    const setter: { current: (p: Base) => void } = { current: () => { } }
    let latest: Base = initial()
    return {
      counters,
      Providers: ({ children }) => {
        const [state, setState] = useState(latest)
        latest = state
        setter.current = p => setState(s => ({ ...s, ...p }))
        return <Ctx.Provider value={state}>{children}</Ctx.Provider>
      },
      Consumer: () => {
        counters.renders++
        const data = useContext(Ctx)
        const sum = useMemo(() => { counters.derives++; return sumOf(data) }, Array.from({ length: KEYS }, (_, k) => data[keyName(k)]))
        return <i>{sum}</i>
      },
      update: (kind, tick) => setter.current(patchFor(kind, tick, latest)),
    }
  },
}

export const derivedAdapters: DerivedAdapter[] = [reactStateCustom, zustand, jotai, reactContext]
