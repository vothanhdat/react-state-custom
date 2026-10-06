import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { Context, deliverOn, getContextInRender, isServer, liveContext, runSelector, useIsomorphicLayoutEffect, useThrowOnFailures } from "./ctx"
import { useSelectorModeCheck, type StoreReadOptions, type StoreRef, type StoreSelect } from "./createAutoCtx"
import { createTracker, FROM_SERVER, type Tracker } from "./useQuickSubscribe"
import { schedulerOf, SYNC, type Scheduler } from "./schedule"
import { storeRefs, type StoreRefTarget } from "./storeRegistry"
import { DependencyTracker, isProduction, shallowEqual } from "./utils"

/** What `useMultipleStore` returns for each ref: what `useStore` returns for its params. */
export type StatesOf<T extends readonly StoreRef<any>[]> = { -readonly [K in keyof T]: T[K] extends { get(): infer S } ? S : never }

/** One instance a component reads: the target of its ref, its context name, and the context it renders with. */
type Slot = { name: string, target: StoreRefTarget, ctx: Context<any> }

const targetOf = (ref: unknown, index: number): StoreRefTarget => {
  const target = typeof ref === "object" && ref !== null ? storeRefs.get(ref) : undefined
  if (target) return target
  throw new TypeError(
    `[react-state-custom] useMultipleStore(refs): refs[${index}] is not a store ref. ` +
    `Make each one with storeRef(params), which createStore returns next to useStore.`
  )
}

/** `next`, or `previous` when it holds the same items: a stable dependency for a list of any length. */
const sameOr = <T,>(previous: T[], next: T[]) =>
  previous.length === next.length && previous.every((item, i) => item === next[i]) ? previous : next

/**
 * The instances `refs` name, each kept and run while the component is mounted: what `useStore`
 * does for its params, for a list whose length may change between renders.
 */
const useInstances = (refs: readonly StoreRef<any>[]) => {
  const [, forceRender] = useState(0)
  /** The context each name renders with, as useDataContext keeps one, until the name leaves the list. */
  const [held] = useState(() => new Map<string, Context<any>>())
  const slots = refs.map((ref, i): Slot => {
    const target = targetOf(ref, i)
    const { name } = target
    DependencyTracker.addDependency(name)
    let ctx = held.get(name)
    if (!ctx) held.set(name, ctx = isServer() ? new Context<any>(name) : getContextInRender(name))
    return { name, target, ctx }
  })
  const key = slots.map(slot => slot.name).join("\n")

  useEffect(() => {
    let adopted = false
    const names = new Set<string>()
    const releases = slots.map(slot => {
      names.add(slot.name)
      // evicted or replaced since the render: see liveContext
      const live = liveContext(slot.name, slot.ctx)
      if (live !== slot.ctx) {
        held.set(slot.name, live)
        adopted = true
      }
      return slot.target.retain()
    })
    for (const name of held.keys()) if (!names.has(name)) held.delete(name)
    if (adopted) forceRender(n => n + 1)
    return () => releases.forEach(release => release())
    // the names say which instances; a context adopted above re-renders, with the same names
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return slots
}

/** What a component reads through the proxies of `useMultipleStore`: one tracker per context, as `useStore` has one. */
const createReaders = () => {
  let version = 0
  const listeners = new Set<() => void>()
  const changed = () => {
    version++
    listeners.forEach(listener => listener())
  }
  /** The tracker of each name, reused by the next render while its context stays the same. */
  const byName = new Map<string, { ctx: Context<any>, tracker: Tracker<any> }>()
  /** Every tracker not disposed for good: a render React discards may have made some. */
  const all = new Set<Tracker<any>>()
  /** The trackers of the latest render, in the order of its refs. */
  let rendering: Tracker<any>[] = []

  const trackerFor = (slot: Slot) => {
    let entry = byName.get(slot.name)
    if (!entry || entry.ctx !== slot.ctx) {
      const tracker = createTracker(slot.ctx)
      tracker.subscribe(changed)
      byName.set(slot.name, entry = { ctx: slot.ctx, tracker })
      all.add(tracker)
    }
    return entry.tracker
  }

  return {
    /** Called at the start of every render, before useSyncExternalStore reads the snapshot. */
    render(slots: Slot[]) {
      rendering = slots.map(trackerFor)
      return rendering
    },
    /** After every commit: the trackers on screen subscribe, the others are disposed. */
    commit(shown: Tracker<any>[], plans: Scheduler[]) {
      shown.forEach((tracker, i) => tracker.commit(plans[i]!))
      const kept = new Set(shown)
      for (const tracker of all) {
        if (kept.has(tracker)) continue
        tracker.dispose()
        all.delete(tracker)
      }
      for (const [name, entry] of byName) if (!kept.has(entry.tracker)) byName.delete(name)
    },
    /** On unmount (and StrictMode's simulated one): unsubscribe, keeping the trackers for a commit that may follow. */
    dispose() {
      all.forEach(tracker => tracker.dispose())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => version,
    /** While hydrating, the render reads what the server rendered when any instance has moved on since. */
    getServerSnapshot: () => rendering.some(tracker => tracker.getServerSnapshot() === FROM_SERVER) ? FROM_SERVER : version,
  }
}

/** The proxy form: one tracking proxy per ref, like `useStore(params)` for each. */
const useProxies = (slots: Slot[], schedule: Scheduler | undefined) => {
  const [readers] = useState(createReaders)
  const trackers = readers.render(slots)
  const plans = slots.map(slot => schedulerOf(schedule ?? slot.target.schedule))

  const snapshot = useSyncExternalStore(readers.subscribe, readers.getSnapshot, readers.getServerSnapshot)
  for (const tracker of trackers) tracker.beginRender(snapshot === FROM_SERVER ? tracker.getServerSnapshot() : snapshot)

  // no deps: subscriptions must follow the keys read in *every* render
  useEffect(() => { readers.commit(trackers, plans) })
  useEffect(() => () => readers.dispose(), [readers])

  return trackers.map(tracker => tracker.view())
}

/** The selector form: `select` over the plain states of every instance, as `useStore(params, { select })` over one. */
const useSelection = <R,>(slots: Slot[], contexts: Context<any>[], selector: (states: object[]) => R, isEqual: (a: R, b: R) => boolean, schedule: Scheduler | undefined) => {
  const lastPlans = useRef<Scheduler[]>([])
  const plans = lastPlans.current = sameOr(lastPlans.current, slots.map(slot => schedulerOf(schedule ?? slot.target.schedule)))

  const subscribe = useMemo(() => (onStoreChange: () => void) => {
    const offs = contexts.map((ctx, i) => {
      const plan = plans[i]!
      if (plan === SYNC) return ctx.subscribeAll(onStoreChange)
      const { listener, cancel } = deliverOn(ctx, plan, onStoreChange)
      const unsub = ctx.subscribeAll(listener)
      return () => {
        unsub()
        cancel()
      }
    })
    return () => offs.forEach(off => off())
  }, [contexts, plans])

  /** The selection on screen. Set after commit, so a render React discards never changes it. */
  const shown = useRef<{ value: R }>(undefined)

  // New snapshot functions whenever the selector or isEqual changes, as in useDataSelector
  const snapshots = useMemo(() => {
    let revisions: number[] | undefined
    let result: R
    let server: { value: R } | undefined

    // recomputed only after some instance's data changed, which its revision says
    const getSnapshot = () => {
      if (revisions && contexts.every((ctx, i) => ctx.revision === revisions![i])) return result
      const next = runSelector(selector, contexts.map(ctx => ctx.data))
      // keep an equal reference, the one on screen first, so React sees no change
      result = shown.current && isEqual(shown.current.value, next) ? shown.current.value
        : revisions && isEqual(result, next) ? result
        : next
      revisions = contexts.map(ctx => ctx.revision)
      return result
    }

    // On the server and while hydrating: what the server rendered, the selection over empty states
    // (stores never run there), unless it equals the live selection
    const getServerSnapshot = () => {
      if (server) return server.value
      const live = getSnapshot()
      const fromServer = runSelector(selector, contexts.map(() => ({})))
      server = { value: isEqual(fromServer, live) ? live : fromServer }
      return server.value
    }

    return { getSnapshot, getServerSnapshot }
  }, [contexts, selector, isEqual])

  const value = useSyncExternalStore(subscribe, snapshots.getSnapshot, snapshots.getServerSnapshot)
  useIsomorphicLayoutEffect(() => { shown.current = { value } }, [value])
  return value
}

/**
 * Read several store instances in one call: `refs` come from `storeRef(params)`, of one store or of
 * several, and their number may change between renders, so a component can read one instance per
 * item of a list. Each instance starts, is shared and stops as with `useStore`.
 *
 * Returns one tracking proxy per ref, as `useStore(params)` returns for each. With `select`, returns
 * `select(states)` over the plain states, in the order of `refs`, and re-renders only when that value
 * changes (by default `shallowEqual`). `schedule` applies to every instance; by default each follows
 * its store's `schedule` option.
 *
 * ```ts
 * const tasks = useMultipleStore(ids.map(id => taskRef({ id })))
 * const unread = useMultipleStore(roomIds.map(id => roomRef({ id })), {
 *   select: rooms => rooms.reduce((sum, room) => sum + (room.unread ?? 0), 0),
 * })
 * ```
 */
export function useMultipleStore<const T extends readonly StoreRef<any>[], R>(refs: T, options: StoreSelect<StatesOf<T>, R>): R
export function useMultipleStore<const T extends readonly StoreRef<any>[]>(refs: T, options?: StoreReadOptions): StatesOf<T>
export function useMultipleStore(refs: readonly StoreRef<any>[], options?: Partial<StoreSelect<object[], unknown>>): unknown {
  const slots = useInstances(refs)
  // the contexts read, the same array until one of them changes
  const lastContexts = useRef<Context<any>[]>([])
  const contexts = lastContexts.current = sameOr(lastContexts.current, slots.map(slot => slot.ctx))
  useThrowOnFailures(contexts)
  const selector = options?.select
  const withSelector = typeof selector === "function"
  // isProduction never changes at runtime, so this conditional hook keeps a stable order
  if (!isProduction) useSelectorModeCheck("useMultipleStore", withSelector)
  // The two forms run different hooks: a call site must always pass a selector or never.
  return withSelector
    ? useSelection(slots, contexts, selector, options?.isEqual ?? shallowEqual, options?.schedule)
    : useProxies(slots, options?.schedule)
}
