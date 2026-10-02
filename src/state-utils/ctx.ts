import { debounce, memoize, DependencyTracker } from "./utils";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

/** useLayoutEffect on the client (publish before paint, no one-frame flash), useEffect on the server. */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect
import { useArrayChangeId } from "./useArrayChangeId"



export const StateScopeContext = createContext<string | null>(null)

const CHANGE_EVENT = "@--change-event"

/** How long an unused Context stays in the cache before being evicted. */
const CACHE_EVICT_DELAY = 100

class DataEvent<D> extends Event {
  constructor(
    public event: keyof D,
    public value: D[typeof event] | undefined
  ) {
    super(String(event));
  }
}

class ChangeEvent<D> extends Event {
  constructor(
    public value: DataEvent<D>
  ) {
    super(CHANGE_EVENT, value);
  }
}

/**
 * Generic context for managing shared state and event subscriptions.
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
   * Registry for tracking active keys (for duplicate detection).
   */
  public registry = new Set<string>()

  public useCounter = 0

  /**
   * Publish a value to the context and notify subscribers if it changed.
   * Change detection uses `Object.is`, so `0` vs `""` and `null` vs `undefined` are distinct.
   * @param key - The key to update.
   * @param value - The new value.
   */
  public publish(key: keyof D, value: D[typeof key] | undefined) {

    if (!Object.is(value, this.data[key])) {
      this.data[key] = value
      let event = new DataEvent(key, value);
      this.dispatchEvent(event);
      this.dispatchEvent(new ChangeEvent(event))
    }
  }

  /**
   * Subscribe to changes for a specific key in the context.
   * @param key - The key to subscribe to.
   * @param _listener - Callback invoked with the new value.
   * @returns Unsubscribe function.
   */
  public subscribe(key: keyof D, _listener: (e: D[typeof key] | undefined) => void) {

    const listener = ({ value }: any) => {
      _listener(value)
    }

    this.addEventListener(String(key), listener)

    if (key in this.data) _listener(this.data[key])

    return () => this.removeEventListener(String(key), listener)
  }

  public subscribeAll(_listener: (changeKey: keyof D, newData: Partial<D>) => void) {

    const listener = (event: any) => {
      if (event instanceof ChangeEvent) {
        const { value: data } = event
        _listener(data.event as any as keyof D, this.data)
      }
    }

    this.addEventListener(String(CHANGE_EVENT), listener)

    return () => this.removeEventListener(String(CHANGE_EVENT), listener)

  }

}

/**
 * Get or create a memoized Context instance by name.
 * @param name - The context name.
 * @returns The Context instance.
 */
export const getContext = memoize((name: string) => new Context<any>(name))

/**
 * Type alias for a function that returns a Context instance.
 */
export type getContext<D> = (e: string) => Context<D>

/**
 * React hook to get a typed Context instance by name.
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
    ref.current = { name: namespacedName, ctx: getContext(namespacedName) }
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
      if (live.useCounter <= 0) {
        setTimeout(() => {
          if (live.useCounter <= 0 && getContext.cache.get(cacheKey) === live) {
            getContext.cache.delete(cacheKey)
          }
        }, CACHE_EVICT_DELAY)
      }
    }
  }, [ctx, namespacedName])

  return ctx as Context<D>
}

/**
 * Internal hook to check for duplicate registry entries in a context.
 * Warns if any of the provided names are already registered.
 * @param ctx - The context instance.
 * @param names - Names to check and register.
 */
const useRegistryChecker = (ctx: Context<any> | undefined, ...names: string[]) => {
  useEffect(
    () => {
      if (ctx) {
        names.forEach(e => ctx.registry.add(e))
        return () => {
          names.forEach(e => ctx.registry.delete(e))
        }
      }
    },
    [ctx, names.length]
  )

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

  useRegistryChecker(ctx, key as any)
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
      if (!next.has(key) && key in ctx.data) {
        ctx.publish(key, undefined)
        delete ctx.data[key]
      }
    }
    published.current.keys = next
  }, [ctx, changeId])

  useRegistryChecker(ctx, ...entries.map(e => e[0]) as any)

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
