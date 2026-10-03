import React, { createContext, useContext, useMemo, useState } from 'react'
import { createStore as createZustandStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { atom, createStore as createJotaiStore, Provider as JotaiProvider, useAtomValue } from 'jotai'
import { AutoRootCtx, createStore } from '../src'
import type { World } from './harness'

/**
 * Topology scenario: a root config store, MIDS derived stores (one per slot, each reading its own
 * threshold from the root) and consumers reading one mid store each. Three updates on the root:
 * `one` changes one threshold (one mid, its consumers), `all` changes every threshold (everything),
 * `unrelated` changes a root key no mid store reads (ideally nothing). `derives` counts mid
 * computations.
 */
export const MIDS = 10
export type TopologyUpdate = 'one' | 'all' | 'unrelated'
export type TopologyWorld = World & { update(kind: TopologyUpdate, tick: number): void }
export type TopologyAdapter = { name: string, create(): TopologyWorld }

type RootState = { thresholds: number[], label: string }
const initial = (): RootState => ({ thresholds: Array.from({ length: MIDS }, () => 0), label: '' })
const nextThresholds = (kind: TopologyUpdate, tick: number, t: number[]) =>
  kind === 'one' ? t.map((v, i) => i === tick % MIDS ? tick : v) : t.map(v => v + 1)
const patchFor = (kind: TopologyUpdate, tick: number, s: RootState): Partial<RootState> =>
  kind === 'unrelated' ? { label: `label-${tick}` } : { thresholds: nextThresholds(kind, tick, s.thresholds) }

let worldId = 0

export const reactStateCustom: TopologyAdapter = {
  name: 'react-state-custom',
  create() {
    const counters = { renders: 0, derives: 0 }
    const root = createStore(`bench-topology-root-${worldId++}`, () => {
      const [state, setState] = useState(initial)
      const patch = (p: Partial<RootState>) => setState(s => ({ ...s, ...p }))
      return { ...state, patch }
    }, { initialState: initial() })
    const mid = createStore(`bench-topology-mid-${worldId++}`, ({ i }: { i: number }) => {
      const { thresholds } = root.useStore()
      counters.derives++
      return { value: thresholds[i] * 2 }
    }, { initialState: { value: 0 } })
    return {
      counters,
      Providers: ({ children }) => <><AutoRootCtx />{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{mid.useStore({ i: k }).value}</i> },
      update: (kind, tick) => { const s = root.getStore().get(); s.patch!(patchFor(kind, tick, s)) },
    }
  },
}

export const zustand: TopologyAdapter = {
  name: 'zustand',
  create() {
    const counters = { renders: 0, derives: 0 }
    const store = createZustandStore<RootState>(initial)
    const selectors = Array.from({ length: MIDS }, (_, i) => (s: RootState) => { counters.derives++; return s.thresholds[i] * 2 })
    return {
      counters,
      Providers: ({ children }) => <>{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useZustandStore(store, selectors[k])}</i> },
      update: (kind, tick) => store.setState(patchFor(kind, tick, store.getState())),
    }
  },
}

export const jotai: TopologyAdapter = {
  name: 'jotai',
  create() {
    const counters = { renders: 0, derives: 0 }
    const store = createJotaiStore()
    const rootAtom = atom(initial())
    const midAtoms = Array.from({ length: MIDS }, (_, i) => atom(get => { counters.derives++; return get(rootAtom).thresholds[i] * 2 }))
    return {
      counters,
      Providers: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useAtomValue(midAtoms[k])}</i> },
      update: (kind, tick) => store.set(rootAtom, s => ({ ...s, ...patchFor(kind, tick, s) })),
    }
  },
}

/** Baseline: the root object in a React context, each consumer deriving its value with useMemo. */
export const reactContext: TopologyAdapter = {
  name: 'React context',
  create() {
    const counters = { renders: 0, derives: 0 }
    const Ctx = createContext<RootState>(initial())
    const setter: { current: (p: Partial<RootState>) => void } = { current: () => { } }
    let latest = initial()
    return {
      counters,
      Providers: ({ children }) => {
        const [state, setState] = useState(latest)
        latest = state
        setter.current = p => setState(s => ({ ...s, ...p }))
        return <Ctx.Provider value={state}>{children}</Ctx.Provider>
      },
      Consumer: ({ k }) => {
        counters.renders++
        const { thresholds } = useContext(Ctx)
        const value = useMemo(() => { counters.derives++; return thresholds[k] * 2 }, [thresholds, k])
        return <i>{value}</i>
      },
      update: (kind, tick) => setter.current(patchFor(kind, tick, latest)),
    }
  },
}

export const topologyAdapters: TopologyAdapter[] = [reactStateCustom, zustand, jotai, reactContext]
