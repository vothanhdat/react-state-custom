import { debounce, memoize, DependencyTracker } from "./utils";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

/** True while rendering on the server (no DOM). Evaluated per call so test environments can toggle it. */
export const isServer = () => typeof window === "undefined"

/** useLayoutEffect on the client (publish before paint, no one-frame flash), useEffect on the server. */
export const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect
import { useArrayChangeId } from "./useArrayChangeId"



export const StateScopeContext = createContext<string | null>(null)

/**
 * The stable wrapper a store publishes for a function-valued key, with the implementation it forwards to.
 * `calledInRender` turns true once a consumer calls the function while rendering (a getter, a selector,
 * a component), from then on a new implementation is announced with `Context.touch`.
 */
export type FunctionSource = { latest: Function, calledInRender: boolean }

/** Stable wrapper -> its source. Filled by createRootCtx, read by the subscribe hooks. */
export const functionSources = new WeakMap<Function, FunctionSource>()

/** The implementation behind a store's function wrapper, or the value itself. */
export const latestOf = (value: unknown) =>
  typeof value === "function" ? functionSources.get(value)?.latest ?? value : value

/** Depth of selector calls in progress: a store function called inside one is a render-time call. */
export const selectorScope = { depth: 0 }

/** How long an unused Context stays in the cache before being evicted. */
const CACHE_EVICT_DELAY = 100

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
 * Generic context for managing shared state and event subscriptions.
 * Still extends EventTarget for compatibility (`instanceof`), but subscriptions no longer go
 * through `addEventListener`/`dispatchEvent`: see `notify` above.
 * @template D - The shape of the data managed by the context.
 */
export class Context<D> extends EventTarget {
  /**
   * Create a new Context instance.
   * @param name - The name of the context (for debugging).
   */
  constructor(public name: string) {
    super();
  }

  /**
   * The current data held by the context.
   */
  public data: Partial<D> = {}
  /**
   * @deprecated Unused since 1.1; kept so existing code that reads it keeps compiling. Will be removed in 2.0.
   */
  public registry = new Set<string>()

  public useCounter = 0

  /**
   * True once a store root has published its first result into this context.
   * `false` while only `initialState` (or nothing) is in `data`. Used by `useStoreSuspense`.
   */
  public ready = false
  private readyListeners = new Set<() => void>()

  /** Mark the context as ready (first publish from a root happened) and notify `onReady` listeners once. */
  public markReady() {
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

  /** Run `listener` when the context fails or recovers. Stable, so it can be passed to useSyncExternalStore. */
  public onStatus = (listener: () => void) => {
    this.statusListeners.add(listener)
    return () => { this.statusListeners.delete(listener) }
  }

  private keyListeners = new Map<keyof D, Set<KeyListener<D, any>>>()
  private allListeners = new Set<AllListener<D>>()

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
   * Notify the subscribers of `keys` although their values are unchanged: a store function whose
   * implementation changed behind its stable wrapper. Subscribers decide whether that matters to them.
   */
  public touch(keys: Iterable<keyof D>) {
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
 * (or replaced by a fresh instance) in the meantime.
 */
const scheduleEvict = (name: string, live: Context<any>) => {
  if (live.useCounter > 0) return
  const cacheKey = getContext.keyFor(name)
  setTimeout(() => {
    if (live.useCounter <= 0 && getContext.cache.get(cacheKey) === live) {
      getContext.cache.delete(cacheKey)
      DependencyTracker.remove(name)
    }
  }, CACHE_EVICT_DELAY)
}

/**
 * Non-hook counterpart of `useDataContext`: get the cached Context for `name` and keep it alive
 * until `release()` is called. Used by the imperative store handle and by `useStoreSuspense`,
 * which must hold a context while no component is committed.
 * On the server it returns a throwaway instance.
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
 * Type alias for a function that returns a Context instance.
 */
export type getContext<D> = (e: string) => Context<D>

/**
 * React hook to get a typed Context instance by name.
 *
 * Server rendering: returns an uncached, throwaway instance (see below); the library is client-side,
 * on the server consumers only ever see `initialState`.
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
export const useDataContext = <D>(name: string = "noname") => {
  const scopeId = useContext(StateScopeContext)
  const namespacedName = scopeId ? `${scopeId}/${name}` : name
  DependencyTracker.addDependency(namespacedName);

  const [, forceRender] = useState(0)
  const ref = useRef<{ name: string, ctx: Context<any> } | null>(null)
  if (!ref.current || ref.current.name !== namespacedName) {
    // On the server nothing publishes or subscribes (effects never run), so instances need not be
    // shared, and the module-level cache would only grow per request because eviction lives in an
    // effect cleanup. Use a throwaway instance there; the HTML comes out identical.
    ref.current = { name: namespacedName, ctx: isServer() ? new Context<any>(namespacedName) : getContext(namespacedName) }
  }
  const ctx = ref.current.ctx

  useEffect(() => {
    const cacheKey = getContext.keyFor(namespacedName)
    let live = getContext.cache.get(cacheKey)
    if (!live) {
      // evicted between render and commit: restore the instance we rendered with
      getContext.cache.set(cacheKey, ctx)
      live = ctx
    } else if (live !== ctx) {
      // someone created a fresh instance in between: adopt it
      ref.current = { name: namespacedName, ctx: live }
      forceRender(c => c + 1)
    }

    live.useCounter += 1;
    return () => {
      live.useCounter -= 1;
      scheduleEvict(namespacedName, live)
    }
  }, [ctx, namespacedName])

  return ctx as Context<D>
}

/**
 * React hook to publish a value to the context when it changes.
 * @param ctx - The context instance.
 * @param key - The key to update.
 * @param value - The new value.
 */
export const useDataSource = <D, K extends keyof D>(ctx: Context<D> | undefined, key: K, value: D[K] | undefined) => {
  useIsomorphicLayoutEffect(() => {
    if (ctx && !Object.is(ctx.data[key], value)) {
      ctx.publish(key, value)
    }
  }, [key, value, ctx])
}

const noopSubscribe = () => () => { }

/**
 * React hook to subscribe to a context value, with optional debounce.
 * Built on `useSyncExternalStore`, so updates are delivered synchronously and
 * consistently across components (no tearing, no extra timer tick).
 * @param ctx - The context instance.
 * @param key - The key to subscribe to.
 * @param debounceTime - Debounce time in ms (default 0).
 * @returns The current value for the key.
 */
export const useDataSubscribe = <D, K extends keyof D>(ctx: Context<D> | undefined, key: K, debounceTime = 0): D[K] | undefined => {
  const store = useMemo(() => {
    if (!ctx) return { subscribe: noopSubscribe, getSnapshot: () => undefined }

    let snapshot = ctx.data[key]
    const read = () => snapshot

    const subscribe = (onStoreChange: () => void) => {
      const notify = () => {
        snapshot = ctx.data[key]
        onStoreChange()
      }
      const listener = debounceTime > 0 ? debounce(notify, debounceTime) : notify
      const unsub = ctx.subscribe(key, listener)
      // make sure the snapshot reflects anything published between render and subscribe
      snapshot = ctx.data[key]
      return () => {
        unsub();
        (listener as any).cancel?.()
      }
    }

    return { subscribe, getSnapshot: read }
  }, [ctx, key, debounceTime])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/**
 * React hook to subscribe to a context value and transform it before returning.
 * The transform is re-run only when the underlying value changes (by `Object.is`)
 * or when a new transform function is passed.
 * @param ctx - The context instance.
 * @param key - The key to subscribe to.
 * @param transform - Function to transform the value.
 * @returns The transformed value.
 */
export const useDataSubscribeWithTransform = <D, K extends keyof D, E>(ctx: Context<D> | undefined, key: K, transform: (e: D[K] | undefined) => E): E => {
  const transformRef = useRef(transform)
  transformRef.current = transform

  const store = useMemo(() => {
    let raw: D[K] | undefined
    let usedTransform: typeof transform | undefined
    let out: E

    const getSnapshot = () => {
      const current = ctx?.data[key]
      const fn = transformRef.current
      if (usedTransform !== fn || !Object.is(current, raw)) {
        raw = current
        usedTransform = fn
        out = fn(current)
      }
      return out
    }

    const subscribe = (onStoreChange: () => void) => ctx ? ctx.subscribe(key, onStoreChange) : () => { }

    return { subscribe, getSnapshot }
  }, [ctx, key])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/**
 * Subscribe to a derived value of the whole context data.
 * `selector` runs against the plain `ctx.data` object (not a proxy), so it may read as deep as it
 * likes; the component re-renders only when the selected value changes according to `isEqual`
 * (default `Object.is`). A new `selector` function each render is fine.
 * @param ctx - The context instance.
 * @param selector - Derives the value from the context data.
 * @param isEqual - Equality used to decide whether the selection changed.
 */
export const useDataSelector = <D, R>(
  ctx: Context<D> | undefined,
  selector: (data: Partial<D>) => R,
  isEqual: (a: R, b: R) => boolean = Object.is
): R => {
  const selectorRef = useRef(selector)
  selectorRef.current = selector
  const isEqualRef = useRef(isEqual)
  isEqualRef.current = isEqual

  const store = useMemo(() => {
    let version = 0
    let computedVersion = -1
    let computedWith: typeof selector | undefined
    let result: R

    const getSnapshot = () => {
      const fn = selectorRef.current
      if (computedVersion === version && computedWith === fn) return result
      let next: R
      // a store function the selector calls is a render-time dependency (see functionSources)
      selectorScope.depth++
      try {
        next = fn((ctx?.data ?? {}) as Partial<D>)
      } finally {
        selectorScope.depth--
      }
      // keep the previous reference when the selection is equal, so React sees no change
      if (computedVersion === -1 || !isEqualRef.current(result, next)) result = next
      computedVersion = version
      computedWith = fn
      return result
    }

    const subscribe = (onStoreChange: () => void) => ctx
      ? ctx.subscribeAll(() => { version++; onStoreChange() })
      : () => { }

    return { subscribe, getSnapshot }
  }, [ctx])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

/**
 * React hook to publish multiple values to the context.
 * Keys that were published by this hook earlier but are no longer present in `entries`
 * are published as `undefined` and removed from the context data.
 * @param ctx - The context instance.
 * @param entries - Array of [key, value] pairs to update.
 */
export const useDataSourceMultiple = <D, T extends readonly (keyof D)[]>(
  ctx: Context<D> | undefined,
  ...entries: { -readonly [P in keyof T]: [T[P], D[T[P]]] }
) => {
  const changeId = useArrayChangeId(entries.flat())
  const published = useRef<{ ctx: Context<D> | undefined, keys: Set<keyof D> }>({ ctx: undefined, keys: new Set() })

  useIsomorphicLayoutEffect(() => {
    if (!ctx) return
    if (published.current.ctx !== ctx) published.current = { ctx, keys: new Set() }

    const next = new Set<keyof D>()
    for (const [key, value] of entries) {
      next.add(key)
      if (!Object.is(ctx.data[key], value)) ctx.publish(key, value)
    }
    for (const key of published.current.keys) {
      if (!next.has(key) && Object.hasOwn(ctx.data, key)) {
        ctx.publish(key, undefined)
        delete ctx.data[key]
      }
    }
    published.current.keys = next
  }, [ctx, changeId])
}

/**
 * Shared implementation for the multi-key subscribe hooks.
 * Keeps a cached tuple snapshot that only changes identity when one of the values changes.
 */
const useMultiKeySnapshot = <D, K extends readonly (keyof D)[]>(
  ctx: Context<D> | undefined,
  keys: K,
  debounceTime: number
): { [i in keyof K]: D[K[i]] | undefined } => {
  const keysId = useArrayChangeId(keys as unknown as any[])

  const store = useMemo(() => {
    const readAll = () => keys.map(key => ctx?.data?.[key])
    let snapshot = readAll()

    const refresh = () => {
      const current = readAll()
      if (current.some((v, i) => !Object.is(v, snapshot[i]))) snapshot = current
    }

    const subscribe = (onStoreChange: () => void) => {
      if (!ctx) return () => { }
      const notify = () => {
        refresh()
        onStoreChange()
      }
      const listener = debounceTime > 0 ? debounce(notify, debounceTime) : notify
      const unsubs = keys.map(key => ctx.subscribe(key, listener))
      refresh()
      return () => {
        (listener as any).cancel?.()
        unsubs.forEach(unsub => unsub())
      }
    }

    return { subscribe, getSnapshot: () => snapshot }
    // keys are captured by content via keysId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, keysId, debounceTime])

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot) as any
}

/**
 * React hook to subscribe to multiple context values.
 * @param ctx - The context instance.
 * @param keys - Keys to subscribe to.
 * @returns An object with the current values for the keys.
 */
export const useDataSubscribeMultiple = <D, K extends readonly (keyof D)[]>(
  ctx: Context<D> | undefined,
  ...keys: K
): { [P in K[number]]: D[P] | undefined } => {
  const values = useMultiKeySnapshot(ctx, keys, 0)

  return useMemo(
    () => Object.fromEntries(keys.map((key, index) => [key, values[index]])) as any,
    // keys are captured by content via values' identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values]
  )
}

/**
 * React hook to subscribe to multiple context values with debouncing.
 * @param ctx - The context instance.
 * @param debounceTime - Debounce time in ms (default 50).
 * @param keys - Keys to subscribe to.
 * @returns Array of current values for the keys.
 */
export const useDataSubscribeMultipleWithDebounce = <D, K extends (keyof D)[]>(
  ctx: Context<D> | undefined,
  debounceTime = 50,
  ...keys: K
): { [i in keyof K]: D[K[i]] | undefined } => {
  return useMultiKeySnapshot(ctx, keys, debounceTime)
}
