import { useEffect, useMemo, useSyncExternalStore } from "react";
import { functionSources, latestOf, type Context } from "./ctx";
import { isProduction } from "./utils";

type Probe = { wrapper: Function, latest: unknown, calledInRender: boolean, fn: Function }

/** What one render read: each key with the value it saw, and the store functions it called with the implementation they ran. */
type Reads<D> = { seen: Map<keyof D, unknown>, called: Map<keyof D, unknown> }

const createReads = <D>(): Reads<D> => ({ seen: new Map(), called: new Map() })

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

const restWarning = (name: string) =>
  `useQuickSubscribe: the state of "${name}" was spread or its keys listed during render. That reads every key, ` +
  `so the component re-renders whenever any of them changes. Read only the keys you need, or use a selector.`

const readOnlyError = (key: PropertyKey) =>
  `useQuickSubscribe: "${String(key)}" is read-only. A write here would change the data under every reader ` +
  `without notifying them. Change the state in the store hook (for example with a setter it returns).`

/** Stores already warned about a spread, so a list of components spreading one store warns once. */
const warnedRest = new Set<string>()

/** Throws for writes through the proxy. Development only, like React freezing props. */
const refuseWrite = (_target: unknown, key: PropertyKey): never => {
  throw new TypeError(readOnlyError(key))
}

/**
 * Per-(component, context) tracker behind useQuickSubscribe.
 *
 * - During render the proxy records every key that is read, together with the value seen.
 * - After commit, those reads become the committed ones and key subscriptions are diffed against them.
 * - A change on any committed key (by `Object.is`) bumps `version`, which is the
 *   `useSyncExternalStore` snapshot, so React re-renders synchronously and consistently.
 * - Changes are checked against the render on screen, not the latest one: React can render and then
 *   discard (a transition that suspends keeps the previous UI on screen while it waits), and a
 *   discarded render must not change what the UI on screen is subscribed to.
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
  /** What the latest render read. It becomes `committed` only if that render commits. */
  let reading = createReads<D>()
  /** What the render on screen read: the keys subscribed to and checked for changes. */
  let committed = createReads<D>()
  /** A render has started since the last commit, so `reading` holds the reads of the render being committed. */
  let rendered = false
  const subs = new Map<keyof D, () => void>()
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
          reading.called.set(key, latestOf(wrapper))
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
      reading.seen.set(key, value)
      return out
    },
    ownKeys(target) {
      if (!isProduction && open && ctx && !warnedRest.has(ctx.name)) {
        warnedRest.add(ctx.name)
        console.warn(restWarning(ctx.name))
      }
      return Reflect.ownKeys(target)
    },
    ...(isProduction ? {} : { set: refuseWrite, deleteProperty: refuseWrite, defineProperty: refuseWrite }),
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
    for (const [key, value] of committed.seen) {
      if (!Object.is(value, current[key])) return true
    }
    for (const [key, latest] of committed.called) {
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
    /** Called at the start of every render: reopen the getter and start recording this render's reads. */
    beginRender(snapshot: number) {
      rendering = snapshot === FROM_SERVER && serverData ? serverData() : undefined
      open = true
      rendered = true
      reading.seen.clear()
      reading.called.clear()
    },
    /**
     * Called after every commit: close the getter, make the committed render's reads current and sync
     * key subscriptions to them. When effects re-run without a new render (StrictMode on mount), it
     * resubscribes what is on screen after `dispose`.
     */
    commit() {
      open = false
      rendering = undefined
      if (rendered) {
        rendered = false
        const shown = reading
        reading = committed
        committed = shown
      }
      if (ctx) {
        for (const key of committed.seen.keys()) {
          if (!subs.has(key)) subs.set(key, ctx.subscribe(key, check))
        }
      }
      for (const [key, unsub] of subs) {
        if (!committed.seen.has(key)) {
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
