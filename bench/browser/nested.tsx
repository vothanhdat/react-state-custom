import React, { useState } from 'react'
import { createStore as createZustandStore, type StoreApi } from 'zustand/vanilla'
import { useStore as useZustandStore } from 'zustand'
import { atom, createStore as createJotaiStore, Provider as JotaiProvider, useAtomValue, type Atom, type PrimitiveAtom } from 'jotai'
import { AutoRootCtx, createStore } from '../../src'
import type { World } from '../harness'

/**
 * Nested scenario: ROOTS stores of FIELDS numeric fields each, and VIEWS views that each read PICKS
 * fields picked by a fixed generator across the roots and render one weighted sum. The same views,
 * picks and updates run against seven ways to hold and read the fields. A stress workload: many
 * views, uncorrelated picks, a one-element view.
 *
 * Four updates: `one-field` and `ten-fields` change fields that views read; `output-unchanged`
 * changes a read field while every view's output stays the same (views sum `floor(value / 10000)`);
 * `unread-field` changes a field no view reads.
 */
export const ROOTS = 3
export const FIELDS = 300
export const VIEWS = 5000
const PICKS = 10

export type NestedUpdate = 'one-field' | 'ten-fields' | 'output-unchanged' | 'unread-field'
export type NestedCounters = { renders: number, derives: number, selectorCalls: number }
export type NestedWorld = World & { counters: NestedCounters, update(): void }
export type NestedAdapter = { name: string, create(kind: NestedUpdate): NestedWorld }

type Key = `f${number}`
type Fields = Record<Key, number>
type Pick = { root: number, field: number, weight: number }
type View = { id: number, picks: Pick[], mask: number } // mask: one bit per root the view reads

const key = (field: number): Key => `f${field}`
const UNREAD = { root: 0, field: FIELDS - 1 }

export const views: View[] = Array.from({ length: VIEWS }, (_, id) => {
  let seed = (id + 31) * 2654435761 >>> 0
  const next = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0 }
  const picks: Pick[] = []
  while (picks.length < PICKS) {
    const p = next() % (ROOTS * FIELDS)
    const root = Math.floor(p / FIELDS), field = p % FIELDS
    if (root === UNREAD.root && field === UNREAD.field) continue
    if (picks.some(x => x.root === root && x.field === field)) continue
    picks.push({ root, field, weight: 1 + (id + picks.length) % 7 })
  }
  return { id, picks, mask: picks.reduce((mask, p) => mask | 1 << p.root, 0) }
})

const seeds = (): Fields[] => Array.from({ length: ROOTS }, (_, root) =>
  Object.fromEntries(Array.from({ length: FIELDS }, (_, field) => [key(field), 100 + (root * FIELDS + field) % 100])) as Fields)

/** The fields an update increments, grouped by root. */
const changesFor = (kind: NestedUpdate): number[][] => {
  const byRoot: number[][] = Array.from({ length: ROOTS }, () => [])
  if (kind === 'ten-fields') for (let i = 0; i < 10; i++) byRoot[i % ROOTS].push(Math.floor(i / ROOTS))
  else if (kind === 'unread-field') byRoot[UNREAD.root].push(UNREAD.field)
  else byRoot[0].push(0)
  return byRoot
}
const bump = (fields: Fields, list: number[]): Fields => {
  const next = { ...fields }
  for (const field of list) next[key(field)]++
  return next
}
const termFor = (kind: NestedUpdate) => kind === 'output-unchanged' ? (v: number) => Math.floor(v / 10000) : (v: number) => v

/** What every view shows after `ticks` updates: the reference the runner checks the DOM against. */
export const expected = (kind: NestedUpdate, ticks: number): number[] => {
  const values = seeds(), term = termFor(kind)
  changesFor(kind).forEach((list, r) => list.forEach(f => { values[r][key(f)] += ticks }))
  return views.map(view => view.picks.reduce((sum, p) => sum + p.weight * term(values[p.root][key(p.field)]), view.id))
}

/**
 * One hook per set of roots a view reads. Each calls its hooks in a fixed order, so a view type
 * never calls a hook in a loop; a view picks the type for its mask.
 */
const byMask = <T,>(use: (root: number, view: View) => T): ((view: View) => (T | undefined)[])[] => [
  () => [],
  v => [use(0, v)],
  v => [undefined, use(1, v)],
  v => [use(0, v), use(1, v)],
  v => [undefined, undefined, use(2, v)],
  v => [use(0, v), undefined, use(2, v)],
  v => [undefined, use(1, v), use(2, v)],
  v => [use(0, v), use(1, v), use(2, v)],
]

/** The view components of a world: one type per mask, rendering what `output` computes from the reads. */
const viewsOf = <T,>(counters: NestedCounters, read: (root: number, view: View) => T, output: (view: View, values: (T | undefined)[]) => number) => {
  const types = byMask(read).map(useReads => function NestedView({ view }: { view: View }) {
    counters.renders++
    return <i>{output(view, useReads(view))}</i>
  })
  return ({ k }: { k: number }) => {
    const ViewType = types[views[k].mask]
    return <ViewType view={views[k]} />
  }
}

/** Sum a view's picks from per-root field records. */
const sumOf = (term: (v: number) => number) => (view: View, values: (Partial<Fields> | undefined)[]) =>
  view.picks.reduce((sum, p) => sum + p.weight * term(values[p.root]![key(p.field)]!), view.id)

/** Per view and root: a selector summing the view's picks in that root. Stable, so subscriptions keep them. */
const selectorsOf = (counters: NestedCounters, term: (v: number) => number) => views.map(view =>
  Array.from({ length: ROOTS }, (_, root) => {
    const picks = view.picks.filter(p => p.root === root)
    return (s: { fields?: Fields }) => {
      counters.selectorCalls++
      return picks.reduce((sum, p) => sum + p.weight * term(s.fields![key(p.field)]), 0)
    }
  }))
const sumOfPartials = (view: View, partials: (number | undefined)[]) => partials.reduce<number>((sum, part) => sum + (part ?? 0), view.id)

let worldId = 0
const newCounters = (): NestedCounters => ({ renders: 0, derives: 0, selectorCalls: 0 })
const rscProviders: World['Providers'] = ({ children }) => <><AutoRootCtx />{children}</>

/** Fields as top-level keys of each root store: the shape the docs recommend. */
export const rscFlatRoot: NestedAdapter = {
  name: 'react-state-custom: flat root',
  create(kind) {
    const counters = newCounters(), changes = changesFor(kind)
    const roots = seeds().map((seed, r) => createStore(`nested-flat-${worldId++}-${r}`, () => {
      const [fields, setFields] = useState(seed)
      return { ...fields, bump: (list: number[]) => setFields(f => bump(f, list)) }
    }, { initialState: seed }))
    return {
      counters,
      Providers: rscProviders,
      Consumer: viewsOf(counters, r => roots[r].useStore(), sumOf(termFor(kind))),
      update: () => changes.forEach((list, r) => list.length && roots[r].getStore().get().bump!(list)),
    }
  },
}

/** The fields under one key: every view of a root re-renders on any change of that root. */
export const rscNestedRoot: NestedAdapter = {
  name: 'react-state-custom: nested root',
  create(kind) {
    const counters = newCounters(), changes = changesFor(kind)
    const roots = nestedRscRoots()
    return {
      counters,
      Providers: rscProviders,
      Consumer: viewsOf(counters, r => roots[r].useStore().fields, sumOf(termFor(kind))),
      update: () => changes.forEach((list, r) => list.length && roots[r].getStore().get().bump!(list)),
    }
  },
}

const nestedRscRoots = () => seeds().map((seed, r) => createStore(`nested-root-${worldId++}-${r}`, () => {
  const [fields, setFields] = useState(seed)
  return { fields, bump: (list: number[]) => setFields(f => bump(f, list)) }
}, { initialState: { fields: seed } }))

/** The nested roots, flattened once per root by a shared store (Composing stores, "Flatten a nested source"). */
export const rscFlattened: NestedAdapter = {
  name: 'react-state-custom: nested root, flattened by a store',
  create(kind) {
    const counters = newCounters(), changes = changesFor(kind)
    const roots = nestedRscRoots()
    const flat = seeds().map((seed, r) => createStore(`nested-flatten-${worldId++}-${r}`, () => {
      counters.derives++
      const { fields } = roots[r].useStore()
      return { ...fields }
    }, { initialState: seed }))
    return {
      counters,
      Providers: rscProviders,
      Consumer: viewsOf(counters, r => flat[r].useStore(), sumOf(termFor(kind))),
      update: () => changes.forEach((list, r) => list.length && roots[r].getStore().get().bump!(list)),
    }
  },
}

/** The nested roots read with a selector per view and root. */
export const rscSelectors: NestedAdapter = {
  name: 'react-state-custom: nested root, selectors',
  create(kind) {
    const counters = newCounters(), changes = changesFor(kind)
    const roots = nestedRscRoots()
    const selectors = selectorsOf(counters, termFor(kind))
    return {
      counters,
      Providers: rscProviders,
      Consumer: viewsOf(counters, (r, view) => roots[r].useStore(undefined, selectors[view.id][r]), sumOfPartials),
      update: () => changes.forEach((list, r) => list.length && roots[r].getStore().get().bump!(list)),
    }
  },
}

export const zustandSelectors: NestedAdapter = {
  name: 'zustand: nested root, selectors',
  create(kind) {
    const counters = newCounters(), changes = changesFor(kind)
    const roots: StoreApi<{ fields: Fields }>[] = seeds().map(fields => createZustandStore(() => ({ fields })))
    const selectors = selectorsOf(counters, termFor(kind))
    return {
      counters,
      Providers: ({ children }) => <>{children}</>,
      Consumer: viewsOf(counters, (r, view) => useZustandStore(roots[r], selectors[view.id][r]), sumOfPartials),
      update: () => changes.forEach((list, r) => list.length && roots[r].setState(s => ({ fields: bump(s.fields, list) }))),
    }
  },
}

/** Jotai, with one atom per view summing read-only field atoms derived from the nested root atoms. */
export const jotaiFieldAtoms: NestedAdapter = {
  name: 'jotai: nested root, derived field atoms',
  create(kind) {
    const counters = newCounters(), changes = changesFor(kind), term = termFor(kind)
    const store = createJotaiStore()
    const roots = seeds().map(fields => atom({ fields }))
    const fieldAtoms = roots.map(root => Array.from({ length: FIELDS }, (_, f) => atom(get => get(root).fields[key(f)])))
    const write = atom(null, (_get, set) => changes.forEach((list, r) => list.length && set(roots[r], s => ({ fields: bump(s.fields, list) }))))
    return jotaiWorld(counters, store, viewAtoms(counters, fieldAtoms, term), () => store.set(write))
  },
}

/** Jotai, with one writable atom per field: no root object at all. */
export const jotaiAtomPerField: NestedAdapter = {
  name: 'jotai: one atom per field',
  create(kind) {
    const counters = newCounters(), changes = changesFor(kind), term = termFor(kind)
    const store = createJotaiStore()
    const fieldAtoms: PrimitiveAtom<number>[][] = seeds().map(fields => Array.from({ length: FIELDS }, (_, f) => atom(fields[key(f)])))
    const write = atom(null, (get, set) => changes.forEach((list, r) => list.forEach(f => set(fieldAtoms[r][f], get(fieldAtoms[r][f]) + 1))))
    return jotaiWorld(counters, store, viewAtoms(counters, fieldAtoms, term), () => store.set(write))
  },
}

const viewAtoms = (counters: NestedCounters, fieldAtoms: Atom<number>[][], term: (v: number) => number) => views.map(view => atom(get => {
  counters.derives++
  return view.picks.reduce((sum, p) => sum + p.weight * term(get(fieldAtoms[p.root][p.field])), view.id)
}))

const jotaiWorld = (counters: NestedCounters, store: ReturnType<typeof createJotaiStore>, outputs: Atom<number>[], update: () => void): NestedWorld => ({
  counters,
  Providers: ({ children }) => <JotaiProvider store={store}>{children}</JotaiProvider>,
  Consumer: ({ k }) => { counters.renders++; return <i>{useAtomValue(outputs[k])}</i> },
  update,
})

export const nestedAdapters: NestedAdapter[] = [rscFlatRoot, rscNestedRoot, rscFlattened, rscSelectors, zustandSelectors, jotaiFieldAtoms, jotaiAtomPerField]
