import React, { createContext, useContext, useMemo, useState } from 'react'
import { createStore as createZustandStore } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { atom, createStore as createJotaiStore, Provider as JotaiProvider, useAtomValue, type Atom } from 'jotai'
import { AutoRootCtx, createStore } from '../src'
import type { Counters, World } from './harness'

/**
 * Shop scenario, a four-layer graph:
 *   config { vat, discount, theme }  ->  line(id) = price * qty * (1 - discount)   (ITEMS lines)
 *   items  { [id]: { price, qty } }  ->  checkout(g) = sum of its 10 lines * (1 + vat)   (GROUPS checkouts)
 *                                    ->  summary = sum of all checkouts
 * 1000 consumers: 500 read a line (5 per item), 300 a checkout (30 per group), 200 the summary.
 * Updates: `qty` of one item (one line, one checkout, the summary change), `vat` (every checkout and
 * the summary change, lines do not), `theme` (nothing downstream reads it), `discount` (everything).
 * `derives` counts line, checkout and summary computations.
 */
export const ITEMS = 100
export const GROUPS = 10
export const CONSUMERS = 1000
export type ShopUpdate = 'qty' | 'vat' | 'theme' | 'discount'
export type ShopWorld = World & { update(kind: ShopUpdate, tick: number): void }
export type ShopAdapter = { name: string, exportName: string, create(): ShopWorld }

type Config = { vat: number, discount: number, theme: string }
type Item = { price: number, qty: number }
type Items = Record<string, Item>
type Role = { kind: 'line', id: string } | { kind: 'checkout', g: number } | { kind: 'summary' }

const itemId = (i: number) => `item${i}`
const itemIds = Array.from({ length: ITEMS }, (_, i) => itemId(i))
const groups = Array.from({ length: GROUPS }, (_, g) => g)
const groupIds = (g: number) => Array.from({ length: ITEMS / GROUPS }, (_, j) => itemId(g * (ITEMS / GROUPS) + j))
const initialConfig = (): Config => ({ vat: 0.1, discount: 0, theme: 'light' })
const initialItems = (): Items => Object.fromEntries(Array.from({ length: ITEMS }, (_, i) => [itemId(i), { price: i + 1, qty: 1 }]))
/** Which value consumer `k` reads; constant per component instance. */
const roleOf = (k: number): Role => k < 500 ? { kind: 'line', id: itemId(k % ITEMS) } : k < 800 ? { kind: 'checkout', g: (k - 500) % GROUPS } : { kind: 'summary' }
const configPatch = (kind: ShopUpdate, tick: number): Partial<Config> =>
  kind === 'vat' ? { vat: 0.1 + tick / 1000 } : kind === 'theme' ? { theme: `theme-${tick}` } : { discount: (tick % 50) / 100 }

/** The three derivations, counted. */
const calcFor = (counters: Counters) => ({
  line: (item: Item, discount: number) => { counters.derives++; return item.price * item.qty * (1 - discount) },
  checkout: (lines: number[], vat: number) => { counters.derives++; return lines.reduce((a, b) => a + b, 0) * (1 + vat) },
  summary: (checkouts: number[]) => { counters.derives++; return checkouts.reduce((a, b) => a + b, 0) },
})
type Calc = ReturnType<typeof calcFor>
/** Everything derived from config + items in one pass (zustand and context recompute it on every write). */
const deriveAll = (calc: Calc, config: Config, items: Items) => {
  const lines = Object.fromEntries(Object.entries(items).map(([id, item]) => [id, calc.line(item, config.discount)]))
  const checkouts = groups.map(g => calc.checkout(groupIds(g).map(id => lines[id]), config.vat))
  return { lines, checkouts, grandTotal: calc.summary(checkouts) }
}
type Derived = ReturnType<typeof deriveAll>

let worldId = 0

/**
 * Each layer is one store returning a flat object (lines keyed by item id, checkouts by group): a layer
 * calls the hook of the layer below once and reads the keys it needs, consumers read one key. A layer
 * re-runs only when a key it read changes and publishes only the keys whose value changed.
 */
export const reactStateCustom: ShopAdapter = {
  name: 'react-state-custom',
  exportName: 'reactStateCustom',
  create() {
    const counters = { renders: 0, derives: 0 }
    const calc = calcFor(counters)
    const { useStore: useConfig, getStore: getConfig } = createStore(`shop-config-${worldId++}`, () => {
      const [state, setState] = useState(initialConfig)
      return { ...state, patch: (p: Partial<Config>) => setState(c => ({ ...c, ...p })) }
    }, { initialState: initialConfig() })
    const { useStore: useItems, getStore: getItems } = createStore(`shop-items-${worldId++}`, () => {
      const [state, setState] = useState(initialItems)
      const setQty = (id: string, qty: number) => setState(it => ({ ...it, [id]: { ...it[id], qty } }))
      return { ...state, setQty } as Items & { setQty: typeof setQty }
    }, { initialState: initialItems() })
    const { useStore: useLines } = createStore(`shop-lines-${worldId++}`, () => {
      const items = useItems()
      const { discount } = useConfig()
      return Object.fromEntries(itemIds.map(id => [id, calc.line(items[id], discount)])) as Record<string, number>
    }, { initialState: Object.fromEntries(itemIds.map(id => [id, 0])) })
    const { useStore: useCheckouts } = createStore(`shop-checkouts-${worldId++}`, () => {
      const lines = useLines()
      const { vat } = useConfig()
      return Object.fromEntries(groups.map(g => [g, calc.checkout(groupIds(g).map(id => lines[id]), vat)])) as Record<number, number>
    }, { initialState: Object.fromEntries(groups.map(g => [g, 0])) })
    const { useStore: useSummary } = createStore(`shop-summary-${worldId++}`, () => {
      const checkouts = useCheckouts()
      return { grandTotal: calc.summary(groups.map(g => checkouts[g])) }
    }, { initialState: { grandTotal: 0 } })
    const read = (role: Role) => role.kind === 'line' ? useLines()[role.id] : role.kind === 'checkout' ? useCheckouts()[role.g] : useSummary().grandTotal
    return {
      counters,
      Providers: ({ children }) => <><AutoRootCtx />{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{read(roleOf(k))}</i> },
      update: (kind, tick) => kind === 'qty'
        ? getItems().get().setQty!(itemId(tick % ITEMS), tick)
        : getConfig().get().patch!(configPatch(kind, tick)),
    }
  },
}

/** Derived values are kept in the store and recomputed by every write, the usual Zustand pattern. */
export const zustand: ShopAdapter = {
  exportName: 'zustand',
  name: 'zustand',
  create() {
    const counters = { renders: 0, derives: 0 }
    const calc = calcFor(counters)
    type S = { config: Config, items: Items } & Derived
    const store = createZustandStore<S>(() => ({ config: initialConfig(), items: initialItems(), ...deriveAll(calc, initialConfig(), initialItems()) }))
    const select = (role: Role) => (s: S) => role.kind === 'line' ? s.lines[role.id] : role.kind === 'checkout' ? s.checkouts[role.g] : s.grandTotal
    return {
      counters,
      Providers: ({ children }) => <>{children}</>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useZustandStore(store, select(roleOf(k)))}</i> },
      update: (kind, tick) => store.setState(s => {
        const config = kind === 'qty' ? s.config : { ...s.config, ...configPatch(kind, tick) }
        const id = itemId(tick % ITEMS)
        const items = kind === 'qty' ? { ...s.items, [id]: { ...s.items[id], qty: tick } } : s.items
        return { config, items, ...deriveAll(calc, config, items) }
      }),
    }
  },
}

/** One atom per config key and per item, derived atoms per line, checkout and the summary. */
export const jotai: ShopAdapter = {
  exportName: 'jotai',
  name: 'jotai',
  create() {
    const counters = { renders: 0, derives: 0 }
    const calc = calcFor(counters)
    const family = <K, A extends Atom<unknown>>(make: (k: K) => A) => { const m = new Map<K, A>(); return (k: K) => m.get(k) ?? (m.set(k, make(k)), m.get(k)!) }
    const store = createJotaiStore()
    const vatAtom = atom(0.1), discountAtom = atom(0), themeAtom = atom('light')
    const itemAtom = family((id: string) => atom(initialItems()[id]))
    const lineAtom = family((id: string) => atom(get => calc.line(get(itemAtom(id)), get(discountAtom))))
    const checkoutAtom = family((g: number) => atom(get => calc.checkout(groupIds(g).map(id => get(lineAtom(id))), get(vatAtom))))
    const summaryAtom = atom(get => calc.summary(groups.map(g => get(checkoutAtom(g)))))
    const atomFor = (role: Role): Atom<number> => role.kind === 'line' ? lineAtom(role.id) : role.kind === 'checkout' ? checkoutAtom(role.g) : summaryAtom
    return {
      counters,
      Providers: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>,
      Consumer: ({ k }) => { counters.renders++; return <i>{useAtomValue(atomFor(roleOf(k)))}</i> },
      update: (kind, tick) => {
        if (kind === 'qty') store.set(itemAtom(itemId(tick % ITEMS)), it => ({ ...it, qty: tick }))
        else if (kind === 'vat') store.set(vatAtom, 0.1 + tick / 1000)
        else if (kind === 'theme') store.set(themeAtom, `theme-${tick}`)
        else store.set(discountAtom, (tick % 50) / 100)
      },
    }
  },
}

/** Baseline: config, items and everything derived from them in one context value. */
export const reactContext: ShopAdapter = {
  exportName: 'reactContext',
  name: 'React context',
  create() {
    const counters = { renders: 0, derives: 0 }
    const calc = calcFor(counters)
    type V = { config: Config, items: Items } & Derived
    const Ctx = createContext<V>(null!)
    const setter: { current: (kind: ShopUpdate, tick: number) => void } = { current: () => { } }
    const read = (v: V, role: Role) => role.kind === 'line' ? v.lines[role.id] : role.kind === 'checkout' ? v.checkouts[role.g] : v.grandTotal
    return {
      counters,
      Providers: ({ children }) => {
        const [config, setConfig] = useState(initialConfig)
        const [items, setItems] = useState(initialItems)
        setter.current = (kind, tick) => {
          if (kind === 'qty') setItems(it => { const id = itemId(tick % ITEMS); return { ...it, [id]: { ...it[id], qty: tick } } })
          else setConfig(c => ({ ...c, ...configPatch(kind, tick) }))
        }
        const value = useMemo(() => ({ config, items, ...deriveAll(calc, config, items) }), [config, items])
        return <Ctx.Provider value={value}>{children}</Ctx.Provider>
      },
      Consumer: ({ k }) => { counters.renders++; return <i>{read(useContext(Ctx), roleOf(k))}</i> },
      update: (kind, tick) => setter.current(kind, tick),
    }
  },
}

export const shopAdapters: ShopAdapter[] = [reactStateCustom, zustand, jotai, reactContext]
