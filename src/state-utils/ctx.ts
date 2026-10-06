import { memoize, DependencyTracker } from "./utils";
import { schedulerOf, SYNC, type Scheduler } from "./schedule";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

/** True while rendering on the server (no DOM). Evaluated per call so test environments can toggle it. */
export const isServer = () => typeof window === "undefined"

/** useLayoutEffect on the client (publish before paint, no one-frame flash), useEffect on the server. */
export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect

/**
 * The stable wrapper a store publishes for a function-valued key, with the implementation it forwards to.
 * `calledInRender` turns true once a consumer calls the function while rendering (a getter, a selector,
 * a component), from then on a new implementation is announced with `Context.touch`.
 */
export type FunctionSource = { latest: Function, calledInRender: boolean, dead?: boolean }

/** Stable wrapper -> its source. Filled by createRootCtx, read by the readers (useQuickSubscribe, selectors). */
export const functionSources = new WeakMap<Function, FunctionSource>()

/** The implementation behind a store's function wrapper, or the value itself. */
export const latestOf = (value: unknown) =>
  typeof value === "function" ? functionSources.get(value)?.latest ?? value : value

/** Depth of selector calls in progress: a store function called inside one is a render-time call. */
export const selectorScope = { depth: 0 }

/**
 * How long an unused Context stays in the cache before being evicted. A retired one (its store
 * instance was torn down) leaves at once: `timeToClean` already kept the instance as long as wanted.
 */
const CACHE_EVICT_DELAY = 100

/** How long a Context created during a render stays cached if no user of it commits. */
const UNCOMMITTED_EVICT_DELAY = 1000

type KeyListener<D, K extends keyof D> = (value: D[K] | undefined) => void
type AllListener<D> = (changeKey: keyof D, newData: Partial<D>) => void

/**
 * Call every listener, then rethrow the first error. Listeners are invoked directly rather than
 * through `EventTarget.dispatchEvent`, which reports listener exceptions to `window.onerror` and
 * carries on: that silently dropped React's "Maximum update depth exceeded" for one subscriber
 * while the others kept a divergent store cycle alive. Thrown synchronously, the error reaches
 * the publishing store's effect and its error boundary disables that store, like a throwing
 * subscriber in Redux or Zustand surfaces at the `dispatch`/`setState` call.
 */
const notify = <L>(listeners: Iterable<L>, call: (listener: L) => void) => {
  let error: unknown
  let failed = false
  for (const listener of [...listeners]) {
    try {
      call(listener)
    } catch (e) {
      if (!failed) { failed = true; error = e }
    }
  }
  if (failed) throw error
}

/**
 * The data of one store instance and the subscriptions to it. Subscribers are called directly, see
 * `notify` above.
 * @template D - The shape of the data managed by the context.
 */
export class Context<D> {
  /**
   * Create a new Context instance.
   * @param name - The name of the context: `"store?params"`, or `"auto-ctx"` for AutoRootCtx.
   */
  constructor(public name: string) { }

  /**
   * The current data held by the context.
   */
  public data: Partial<D> = {}

  /** Components and handles holding this context in the cache (see scheduleEvict). */
  public useCounter = 0

  /**
   * True once a store hook has published its first result into this context, until the instance is
   * torn down. Read by `storeRef(params).ready` and by readers with a schedule, whose first data is
   * never delayed.
   */
  public ready = false
  private readyListeners = new Set<() => void>()

  /** Mark the context as ready (first publish from a root happened) and notify `onReady` listeners once. */
  public markReady() {
    this.retired = false
    if (this.ready) return
    this.ready = true
    const listeners = [...this.readyListeners]
    this.readyListeners.clear()
    listeners.forEach(l => l())
  }

  /** Run `listener` when the context becomes ready (immediately if it already is). Returns an unsubscribe. */
  public onReady(listener: () => void) {
    if (this.ready) {
      listener()
      return () => { }
    }
    this.readyListeners.add(listener)
    return () => { this.readyListeners.delete(listener) }
  }

  /** True while the store hook behind this context has thrown and is disabled (see `fail`). */
  public failed = false
  /** What the store hook threw, while `failed`. */
  public error: unknown = undefined
  private statusListeners = new Set<() => void>()

  /**
   * Record that the store hook threw. Called by AutoRootCtx while React handles the error, so the
   * listeners run in a microtask, outside that render.
   */
  public fail(error: unknown) {
    if (this.failed && Object.is(this.error, error)) return
    this.failed = true
    this.error = error
    queueMicrotask(() => notify(this.statusListeners, listener => listener()))
  }

  /** Clear a failure: the failed instance was torn down, the next one starts clean. */
  public recover() {
    if (!this.failed) return
    this.failed = false
    this.error = undefined
    notify(this.statusListeners, listener => listener())
  }

  /** Store instances running on this context: one, unless several AutoRootCtx are mounted. */
  public instances = 0

  /**
   * True after the store instance publishing here was torn down, until another one is ready.
   * Its values stay for whoever still holds this context (a component that rendered with it, a
   * subscriber), but its actions are gone.
   */
  public retired = false

  /**
   * The store instance was torn down. Its actions leave `data`: a component that mounts before the
   * next instance publishes (one restoring this context, as one inside an `<Activity>` shown again
   * does) reads them as `undefined`, as before any instance ran. The context is no longer ready, and
   * it leaves the cache as soon as nothing holds it, instead of after `CACHE_EVICT_DELAY`.
   */
  public retire() {
    const dead = Object.keys(this.data).filter(key => functionSources.get(this.data[key as keyof D] as Function)?.dead)
    this.publishMany([], dead as (keyof D)[])
    this.retired = true
    if (this.ready) {
      this.ready = false
      notify(this.statusListeners, listener => listener())
    }
    scheduleEvict(this.name, this)
  }

  /** Run `listener` when the context fails, recovers or retires. Stable, so it can be passed to useSyncExternalStore. */
  public onStatus = (listener: () => void) => {
    this.statusListeners.add(listener)
    return () => { this.statusListeners.delete(listener) }
  }

  private keyListeners = new Map<keyof D, Set<KeyListener<D, any>>>()
  private allListeners = new Set<AllListener<D>>()

  /**
   * Bumped on every `publish`, `publishMany` and `touch`, before any subscriber runs. A reader that
   * caches what it derived from `data` compares it to know whether `data` changed, including while it
   * had no subscription yet (between its render and its subscribe).
   */
  public revision = 0

  private snapshotOf?: { revision: number, data: Partial<D> }

  /**
   * A copy of `data`, the same object until the data changes: what `storeRef(params).get()` returns.
   * Stable, so it can be a `useSyncExternalStore` snapshot; shared by every caller, so it is frozen.
   */
  public snapshot(): Partial<D> {
    if (this.snapshotOf?.revision !== this.revision) {
      this.snapshotOf = { revision: this.revision, data: Object.freeze({ ...this.data }) }
    }
    return this.snapshotOf.data
  }

  /**
   * Publish a value to the context and notify subscribers if it changed.
   * Change detection uses `Object.is`, so `0` vs `""` and `null` vs `undefined` are distinct.
   * Every subscriber is notified even if one throws; the first error is then rethrown to the caller.
   * @param key - The key to update.
   * @param value - The new value.
   */
  public publish(key: keyof D, value: D[typeof key] | undefined) {
    if (Object.is(value, this.data[key])) return
    this.data[key] = value
    this.revision++
    const forKey = this.keyListeners.get(key)
    let error: unknown
    let failed = false
    try {
      if (forKey) notify(forKey, listener => listener(value))
    } catch (e) {
      failed = true; error = e
    }
    try {
      notify(this.allListeners, listener => listener(key, this.data))
    } catch (e) {
      if (!failed) { failed = true; error = e }
    }
    if (failed) throw error
  }

  /**
   * Subscribe to changes for a specific key in the context.
   * The listener is called right away with the current value if the key is present.
   * Subscribing the same function twice registers it twice; each unsubscribe removes one registration.
   * @param key - The key to subscribe to.
   * @param _listener - Callback invoked with the new value.
   * @returns Unsubscribe function.
   */
  public subscribe(key: keyof D, _listener: (e: D[typeof key] | undefined) => void) {
    const listener: KeyListener<D, typeof key> = value => _listener(value)
    let set = this.keyListeners.get(key)
    if (!set) {
      set = new Set()
      this.keyListeners.set(key, set)
    }
    set.add(listener)

    if (Object.hasOwn(this.data, key)) _listener(this.data[key])

    return () => {
      set.delete(listener)
      if (set.size === 0 && this.keyListeners.get(key) === set) this.keyListeners.delete(key)
    }
  }

  /**
   * Publish several keys as one update: every value is assigned (and every key in `removed` deleted)
   * before any subscriber runs, so each of them sees the complete new state, never a mix of new and
   * old keys. Keys equal by `Object.is` are skipped. Errors are handled as in `publish`.
   */
  public publishMany(entries: Iterable<readonly [keyof D, D[keyof D] | undefined]>, removed: Iterable<keyof D> = []) {
    const changed: (keyof D)[] = []
    for (const [key, value] of entries) {
      if (Object.is(value, this.data[key])) continue
      this.data[key] = value
      changed.push(key)
    }
    for (const key of removed) {
      if (!Object.hasOwn(this.data, key)) continue
      delete this.data[key]
      changed.push(key)
    }
    if (changed.length > 0) this.touch(changed)
  }

  /**
   * Notify the subscribers of `keys` although their values are unchanged: a store function whose
   * implementation changed behind its stable wrapper. Subscribers decide whether that matters to them.
   */
  public touch(keys: Iterable<keyof D>) {
    this.revision++
    let error: unknown
    let failed = false
    const run = (fn: () => void) => {
      try { fn() } catch (e) { if (!failed) { failed = true; error = e } }
    }
    for (const key of keys) {
      const forKey = this.keyListeners.get(key)
      if (forKey) run(() => notify(forKey, listener => listener(this.data[key])))
      run(() => notify(this.allListeners, listener => listener(key, this.data)))
    }
    if (failed) throw error
  }

  /** Subscribe to every change: the listener receives the changed key and the whole data object. */
  public subscribeAll(_listener: (changeKey: keyof D, newData: Partial<D>) => void) {
    const listener: AllListener<D> = (key, data) => _listener(key, data)
    this.allListeners.add(listener)
    return () => { this.allListeners.delete(listener) }
  }

}

/**
 * Get or create a memoized Context instance by name.
 * @param name - The context name.
 * @returns The Context instance.
 */
export const getContext = memoize((name: string) => new Context<any>(name))

/**
 * Evict `live` from the cache shortly after its last user leaves, unless it was picked up again
 * (or replaced by a fresh instance) in the meantime. A retired context is evicted at once.
 */
const scheduleEvict = (name: string, live: Context<any>, delay = CACHE_EVICT_DELAY) => {
  if (live.useCounter > 0) return
  const cacheKey = getContext.keyFor(name)
  const evict = () => {
    if (live.useCounter <= 0 && getContext.cache.get(cacheKey) === live) {
      getContext.cache.delete(cacheKey)
      DependencyTracker.remove(name)
    }
  }
  if (live.retired) evict()
  else setTimeout(evict, delay)
}

/**
 * `getContext` for a render. A render may never commit (it suspended, threw or was discarded), and
 * then no effect ever counts or releases the instance, so one created here is evicted unless a user
 * has committed by then. A render that commits later restores it (see useDataContext).
 */
export const getContextInRender = (name: string) => {
  const cached = getContext.fromCache(name)
  if (cached) return cached
  const ctx = getContext(name)
  scheduleEvict(name, ctx, UNCOMMITTED_EVICT_DELAY)
  return ctx
}

/**
 * On commit, the live context for `name`. A component may render before the eviction timer fires and
 * commit after it: if the entry was evicted in between, the rendered instance is restored to the
 * cache; if another component already created a fresh instance, that one is returned, and the
 * caller adopts it (one re-render) so a name never maps to two live Contexts.
 */
export const liveContext = <D>(name: string, rendered: Context<D>): Context<D> => {
  const cacheKey = getContext.keyFor(name)
  const live = getContext.cache.get(cacheKey)
  if (live) return live
  getContext.cache.set(cacheKey, rendered)
  return rendered
}

/**
 * The context a component renders with for `name`. On the server nothing publishes or subscribes
 * (effects never run), so instances need not be shared, and the module-level cache would only grow
 * per request because eviction lives in an effect cleanup: a throwaway instance there; the HTML comes
 * out identical.
 */
export const contextForRender = <D>(name: string) =>
  (isServer() ? new Context<D>(name) : getContextInRender(name)) as Context<D>

/**
 * On commit, hold the context a component rendered with until `release()`: counted while held, and
 * evicted shortly after the last holder releases it. `ctx` is the live instance (see liveContext),
 * which is not `rendered` when another component created a fresh one in between: the caller adopts it.
 */
export const holdContext = <D>(rendered: Context<D>) => {
  const live = liveContext(rendered.name, rendered)
  live.useCounter += 1
  return {
    ctx: live,
    release: () => {
      live.useCounter -= 1
      scheduleEvict(live.name, live)
    },
  }
}

/**
 * Non-hook counterpart of `useDataContext`: get the cached Context for `name` and keep it alive
 * until `release()` is called. Used by `storeRef(params)`, which holds a context while no
 * component is committed. On the server it returns a throwaway instance.
 */
export const acquireContext = <D>(name: string): { ctx: Context<D>, release: () => void } => {
  if (isServer()) return { ctx: new Context<D>(name), release: () => { } }
  const ctx = getContext(name) as Context<D>
  ctx.useCounter += 1
  let released = false
  return {
    ctx,
    release: () => {
      if (released) return
      released = true
      ctx.useCounter -= 1
      scheduleEvict(name, ctx)
    },
  }
}

/**
 * React hook to get a typed Context instance by name.
 *
 * Server rendering: returns an uncached, throwaway instance (see below); the library is client-side,
 * and on the server readers see an empty state.
 *
 * Instances are reference counted: the context is evicted from the cache shortly after
 * the last user unmounts. Because a component may render before the eviction timer fires
 * and commit after it, the effect re-validates the instance against the cache on commit:
 * - if the entry was evicted in between, the rendered instance is restored to the cache;
 * - if another component already created a fresh instance, this component adopts it
 *   (one re-render) so a name never maps to two live Contexts.
 *
 * @param name - The context name.
 * @returns The Context instance.
 */
export const useDataContext = <D>(name: string) => {
  DependencyTracker.addDependency(name);

  const [, forceRender] = useState(0)
  const ref = useRef<{ name: string, ctx: Context<any> } | null>(null)
  if (!ref.current || ref.current.name !== name) ref.current = { name, ctx: contextForRender(name) }
  const ctx = ref.current.ctx

  useEffect(() => {
    const held = holdContext(ctx)
    if (held.ctx !== ctx) {
      // someone created a fresh instance in between: adopt it
      ref.current = { name, ctx: held.ctx }
      forceRender(c => c + 1)
    }
    return held.release
  }, [ctx, name])

  return ctx as Context<D>
}

/**
 * Run `deliver` for a change now, or when `plan` says. A context's first data is delivered at once,
 * when it becomes ready (it publishes just before): a schedule limits how often, not how soon data
 * arrives. Returns the listener and a cleanup that forgets a pending delivery.
 */
export const deliverOn = (ctx: Context<any>, plan: Scheduler, deliver: () => void) => {
  if (plan === SYNC) return { listener: deliver, cancel: () => { } }
  const task = plan.task(deliver)
  const offReady = ctx.ready ? undefined : ctx.onReady(() => {
    task.cancel()
    deliver()
  })
  return {
    listener: () => task.request(),
    cancel: () => {
      offReady?.()
      task.cancel()
    },
  }
}

const notFailed = () => false

/**
 * A store hook that threw disables its instance until the instance is torn down (see StoreBoundary):
 * its readers throw its error during render, for their own error boundary, so the failure shows where
 * the store is used while every other store keeps running. Stores never run on the server, so the
 * server (and hydration) snapshot is "not failed".
 */
export const useThrowOnFailure = (ctx: Context<any>) => {
  if (useSyncExternalStore(ctx.onStatus, () => ctx.failed, notFailed)) throw ctx.error
}

const noFailure = () => undefined

/** `useThrowOnFailure` for a list of contexts, stable until one of them changes: the first that failed throws. */
export const useThrowOnFailures = (contexts: readonly Context<any>[]) => {
  const subscribe = useMemo(() => (listener: () => void) => {
    const offs = contexts.map(ctx => ctx.onStatus(listener))
    return () => offs.forEach(off => off())
  }, [contexts])
  const failed = useSyncExternalStore(subscribe, () => contexts.find(ctx => ctx.failed), noFailure)
  if (failed) throw failed.error
}

/** Run a selector; a store function it calls is a render-time dependency (see functionSources). */
export const runSelector = <D, R>(selector: (data: D) => R, data: D) => {
  selectorScope.depth++
  try {
    return selector(data)
  } finally {
    selectorScope.depth--
  }
}

/**
 * Subscribe to a derived value of the whole context data: `useStore(params, { select })`.
 * `selector` runs against the plain `ctx.data` object (not a proxy), so it may read as deep as it
 * likes; the component re-renders only when the selected value changes according to `isEqual`
 * (default `Object.is`; useStore passes `shallowEqual`). A new `selector` function each render is fine.
 * With a `schedule` such as `frame()`, React is told about changes when the schedule says, and
 * the selector runs then, on the data of that moment.
 * @param ctx - The context instance.
 * @param selector - Derives the value from the context data.
 * @param isEqual - Equality used to decide whether the selection changed.
 */
export const useDataSelector = <D, R>(
  ctx: Context<D> | undefined,
  selector: (data: Partial<D>) => R,
  isEqual: (a: R, b: R) => boolean = Object.is,
  /** When the component re-renders for a change: `frame()`, `throttle(ms)`, ... (default at once). */
  schedule?: Scheduler
): R => {
  const plan = schedulerOf(schedule)
  const subscribe = useMemo(() => (onStoreChange: () => void) => {
    if (!ctx) return () => { }
    if (plan === SYNC) return ctx.subscribeAll(onStoreChange)
    const { listener, cancel } = deliverOn(ctx, plan, onStoreChange)
    const unsub = ctx.subscribeAll(listener)
    return () => {
      unsub()
      cancel()
    }
  }, [ctx, plan])

  /** The selection on screen. Set after commit, so a render React discards never changes it. */
  const shown = useRef<{ value: R }>(undefined)

  // New snapshot functions whenever the selector or isEqual changes. useSyncExternalStore checks for
  // changes with those of the committed render, so a selector from a render React discarded (a
  // transition waiting on a suspended sibling) is never used for that.
  const snapshots = useMemo(() => {
    let computedRevision = -1
    let result: R
    let server: { value: R } | undefined

    // The selection is recomputed only after `data` changed. The context's revision says so even for a
    // change made before this component subscribed: React checks the snapshot once more after
    // subscribing, and a counter bumped by our own listener would have missed it.
    const getSnapshot = () => {
      const revision = ctx?.revision ?? 0
      if (computedRevision === revision) return result
      const next = runSelector(selector, (ctx?.data ?? {}) as Partial<D>)
      // keep an equal reference, the one on screen first, so React sees no change
      result = shown.current && isEqual(shown.current.value, next) ? shown.current.value
        : computedRevision !== -1 && isEqual(result, next) ? result
        : next
      computedRevision = revision
      return result
    }

    // On the server and while hydrating: what the server rendered, the selection of an empty state
    // (stores never run there), unless it equals the live selection. React re-renders with the live
    // selection once hydrated.
    const getServerSnapshot = () => {
      if (server) return server.value
      const live = getSnapshot()
      const fromServer = runSelector(selector, {} as Partial<D>)
      server = { value: isEqual(fromServer, live) ? live : fromServer }
      return server.value
    }

    return { getSnapshot, getServerSnapshot }
  }, [ctx, selector, isEqual])

  const value = useSyncExternalStore(subscribe, snapshots.getSnapshot, snapshots.getServerSnapshot)
  useIsomorphicLayoutEffect(() => { shown.current = { value } }, [value])
  return value
}
