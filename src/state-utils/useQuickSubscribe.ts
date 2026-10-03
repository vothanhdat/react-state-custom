import { useEffect, useMemo, useSyncExternalStore } from "react";
import { functionSources, latestOf, type Context } from "./ctx";
import { isProduction } from "./utils";

type Probe = { wrapper: Function, latest: unknown, calledInRender: boolean, fn: Function }

/** Server snapshot meaning "render what the server rendered": the live data has moved on since. */
const FROM_SERVER = -1

/** True when `live` holds a value the server could not have rendered from `seed`. */
const differsFromSeed = (seed: Record<PropertyKey, unknown>, live: Record<PropertyKey, unknown>) => {
  for (const key of Object.keys(seed)) if (!Object.is(seed[key], live[key])) return true
  for (const key of Object.keys(live)) if (!Object.hasOwn(seed, key) && live[key] !== undefined) return true
  return false
}

const outOfRenderWarning = (key: PropertyKey) =>
  `useQuickSubscribe: "${String(key)}" was read outside of render (e.g. in an event handler or effect). ` +
  `The value is current, but this read is not tracked, so later changes to it will not re-render the component. ` +
  `Read it during render and capture it, or use useDataSubscribe for ad-hoc reads.`

/**
 * Per-(component, context) tracker behind useQuickSubscribe.
 *
 * - During render the proxy records every key that is read, together with the value seen.
 * - After commit, key subscriptions are diffed against the keys read in the latest render.
 * - A change on any tracked key (by `Object.is`) bumps `version`, which is the
 *   `useSyncExternalStore` snapshot, so React re-renders synchronously and consistently.
 * - While hydrating, reads come from `serverData` (what the server rendered) when the live data has
 *   already moved on, e.g. a store that ran for an earlier island or Suspense boundary.
 */
function createTracker<D>(ctx: Context<D> | undefined) {
  let open = true
  let version = 0
  /** The data this render reads from instead of the live data (the server's, while hydrating). */
  let rendering: Partial<D> | undefined
  let serverData: (() => Partial<D>) | undefined
  let serverSnapshot: number | undefined

  const listeners = new Set<() => void>()
  const readKeys = new Set<keyof D>()
  const seen = new Map<keyof D, unknown>()
  const subs = new Map<keyof D, () => void>()
  /** Store functions called during the latest render, with the implementation they ran. */
  const called = new Map<keyof D, unknown>()
  const probes = new Map<keyof D, Probe>()

  const data = () => (ctx?.data ?? {}) as Partial<D>
  const readable = () => (open && rendering) || data()

  const warned = new Set<PropertyKey>()

  /**
   * What a read of a store function returns: a function bound to this component that records a call
   * made while rendering, so a new implementation (a `useCallback` whose deps changed) re-renders it.
   * Its identity is stable, like the action's, except once called during render: then it changes with
   * the implementation, so memoized children that call it re-render too.
   */
  const probeFor = (key: keyof D, wrapper: Function) => {
    const latest = latestOf(wrapper)
    let probe = probes.get(key)
    if (probe && probe.wrapper === wrapper && !(probe.calledInRender && probe.latest !== latest)) {
      probe.latest = latest
      return probe.fn
    }
    const created: Probe = {
      wrapper,
      latest,
      calledInRender: false,
      fn: function (this: unknown, ...args: unknown[]) {
        if (open) {
          created.calledInRender = true
          called.set(key, latestOf(wrapper))
          functionSources.get(wrapper)!.calledInRender = true
        }
        return wrapper.apply(this, args)
      },
    }
    try {
      Object.defineProperty(created.fn, "name", { value: wrapper.name })
    } catch { /* non-configurable in exotic environments; ignore */ }
    probes.set(key, created)
    return created.fn
  }

  const handler: ProxyHandler<any> = {
    get(_target, p) {
      const current = readable() as any
      // Symbols (Symbol.toPrimitive, Symbol.iterator, devtools probes, ...) and inherited Object.prototype
      // members (toString, valueOf, hasOwnProperty, ...) are not store keys: pass through untracked.
      if (typeof p === "symbol" || (!Object.hasOwn(current, p) && p in Object.prototype)) return current[p]
      const key = p as keyof D
      const value = current[key]
      const out = typeof value === "function" && functionSources.has(value) ? probeFor(key, value) : value
      if (!open) {
        if (!isProduction && !warned.has(key)) {
          warned.add(key)
          console.warn(outOfRenderWarning(key))
        }
        return out
      }
      readKeys.add(key)
      seen.set(key, value)
      return out
    },
    ownKeys(target) {
      console.warn("useQuickSubscribe: Rest object operations aren't recommended as they bypass selective subscription and may cause performance issues")
      return Reflect.ownKeys(target)
    },
  }

  /**
   * A fresh Proxy per render, over the same tracker. The React Compiler memoises work on the
   * identity of its inputs: with one long-lived proxy, `helper(store)` would be cached forever and
   * the keys the helper reads would stop being tracked. A new object each render keeps every read
   * observable; the compiler still memoises on the primitive values read out of it.
   */
  const view = () => new Proxy(readable() as any, handler) as { [P in keyof D]?: D[P] | undefined }

  const hasChanged = () => {
    const current = data()
    for (const key of readKeys) {
      if (!Object.is(seen.get(key), current[key])) return true
    }
    for (const [key, latest] of called) {
      if (latestOf(current[key]) !== latest) return true
    }
    return false
  }

  const check = () => {
    if (hasChanged()) {
      version++
      listeners.forEach(l => l())
    }
  }

  return {
    view,
    /** Called at the start of every render: reopen the getter and forget last render's reads. */
    beginRender(snapshot: number) {
      rendering = snapshot === FROM_SERVER && serverData ? serverData() : undefined
      open = true
      readKeys.clear()
      called.clear()
    },
    /** Called after every commit: close the getter and sync key subscriptions to what was read. */
    commit() {
      open = false
      rendering = undefined
      if (ctx) {
        for (const key of readKeys) {
          if (!subs.has(key)) subs.set(key, ctx.subscribe(key, check))
        }
      }
      for (const [key, unsub] of subs) {
        if (!readKeys.has(key)) {
          unsub()
          subs.delete(key)
        }
      }
      // catch anything published between render and commit
      check()
    },
    dispose() {
      subs.forEach(unsub => unsub())
      subs.clear()
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => version,
    /** What the server rendered for this context; read lazily by getServerSnapshot and beginRender. */
    setServerData(server: (() => Partial<D>) | undefined) {
      serverData = server
    },
    /**
     * Used by React on the server and while hydrating. Without `serverData` it is the live snapshot.
     * With it, a component hydrating after the store has published (another island or Suspense
     * boundary started it) renders the server's data first, then React re-renders it with live data.
     */
    getServerSnapshot: () => {
      if (serverSnapshot === undefined) {
        serverSnapshot = serverData && differsFromSeed(serverData() as any, data() as any) ? FROM_SERVER : version
      }
      return serverSnapshot
    },
  }
}

/**
 * useQuickSubscribe is a custom React hook for efficiently subscribing to specific properties of a context's data object.
 * 
 * @template D - The shape of the context data.
 * @param {Context<D> | undefined} ctx - The context object containing data and a subscribe method.
 * @returns {Partial<D>} A proxy object that mirrors the context data, automatically subscribing to properties as they are accessed.
 *
 * This hook tracks which properties of the context data are accessed by the component and subscribes to updates for only those properties.
 * When any of the subscribed properties change, the hook triggers a re-render. Subscriptions are managed and cleaned up automatically
 * when the component unmounts or the context changes. This approach minimizes unnecessary re-renders and resource usage by only
 * subscribing to the data that the component actually uses.
 *
 * Read the proxy during render: those reads are tracked. Reads outside render (handlers, effects)
 * return the current value but are not tracked, and log a one-time warning in development.
 * When `ctx` is undefined every property reads as `undefined` and nothing is subscribed.
 * The returned object is a new proxy on every render (see `view` in createTracker), so do not
 * use its identity as a dependency; use the values read from it.
 *
 * Example usage:
 *   const {name} = useQuickSubscribe(userContext);
 *   // Accessing name will subscribe to changes in 'name' only
 *   return <div>{name}</div>;
 */
export const useQuickSubscribe = <D>(
  ctx: Context<D> | undefined,
  /** What the server rendered for this context (a store's `initialState`), read while hydrating. */
  serverData?: () => Partial<D>
): {
    [P in keyof D]?: D[P] | undefined;
  } => {

  const tracker = useMemo(() => createTracker(ctx), [ctx])

  tracker.setServerData(serverData)
  const snapshot = useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, tracker.getServerSnapshot)
  tracker.beginRender(snapshot)

  // no deps: subscriptions must follow the keys read in *every* render
  useEffect(() => { tracker.commit() })

  useEffect(() => () => tracker.dispose(), [tracker])

  return tracker.view()
};
