import { useEffect, useMemo, useSyncExternalStore } from "react";
import { functionSources, latestOf, type Context } from "./ctx";
import { isProduction } from "./utils";
import { schedulerOf, SYNC, type Scheduler } from "./schedule";

type Probe = { wrapper: Function, latest: unknown, calledInRender: boolean, fn: Function }

/**
 * What one render read: each key with the value it saw, the store functions it called with the
 * implementation they ran, the keys it asked about with `in` and whether they were there, and the
 * key list when it enumerated the state (`Object.keys`, a spread, `for...in`).
 */
type Reads<D> = {
  seen: Map<keyof D, unknown>,
  called: Map<keyof D, unknown>,
  present: Map<keyof D, boolean>,
  keys: PropertyKey[] | undefined,
  /** The store had published (it was ready) when this render read it: its first data is not scheduled. */
  ready: boolean,
}

const createReads = <D>(): Reads<D> => ({ seen: new Map(), called: new Map(), present: new Map(), keys: undefined, ready: false })

const sameKeys = (a: PropertyKey[], b: PropertyKey[]) => a.length === b.length && a.every((key, i) => key === b[i])

/** Server snapshot meaning "render what the server rendered": the live data has moved on since. */
export const FROM_SERVER = -1

/** True when `live` holds a value the server could not have rendered: any key that is not `undefined`. */
const hasValues = (live: Record<PropertyKey, unknown>) => {
  for (const key of Object.keys(live)) if (live[key] !== undefined) return true
  return false
}

const outOfRenderWarning = (key: PropertyKey) =>
  `useStore: "${String(key)}" was read outside the render of the component that called useStore: in an event ` +
  `handler, an effect, or a child component the proxy was passed to. The value is current, but this read is not ` +
  `tracked, so later changes to it re-render nothing. Read it during that render and pass the value on, call ` +
  `useStore in the component that reads it, or use storeRef(params).get() in a handler.`

const restWarning = (name: string) =>
  `useStore: the state of "${name}" was spread during render. That reads every key, ` +
  `so the component re-renders whenever any of them changes. Read only the keys you need, or use a selector.`

const readOnlyError = (key: PropertyKey) =>
  `useStore: "${String(key)}" is read-only. A write here would change the data under every reader ` +
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
 * - While hydrating, reads come from an empty state (what the server rendered) when the live data has
 *   already moved on, e.g. a store that ran for an earlier island or Suspense boundary.
 * - With a schedule other than `'sync'`, a change asks for a check when the schedule says, which
 *   compares with the data of that moment. A store's first data (it becomes ready after the render on
 *   screen) is checked at once: a schedule limits how often the UI updates, not how soon it loads.
 */
export function createTracker<D>(ctx: Context<D> | undefined) {
  let open = true
  let version = 0
  /** The data this render reads from instead of the live data (the server's, while hydrating). */
  let rendering: Partial<D> | undefined
  let serverSnapshot: number | undefined

  const listeners = new Set<() => void>()
  /** What the latest render read. It becomes `committed` only if that render commits. */
  let reading = createReads<D>()
  /** What the render on screen read: the keys subscribed to and checked for changes. */
  let committed = createReads<D>()
  /** A render has started since the last commit, so `reading` holds the reads of the render being committed. */
  let rendered = false
  const subs = new Map<keyof D, () => void>()
  /** Subscription to every change, held while the render on screen enumerated the keys. */
  let subAll: (() => void) | undefined
  const probes = new Map<keyof D, Probe>()

  const data = () => (ctx?.data ?? {}) as Partial<D>
  const readable = () => (open && rendering) || data()

  const warned = new Set<PropertyKey>()

  /** Renders so far: each view of a render knows its number (development only, see `listing`). */
  let renders = 0
  /**
   * Development only. React's development build lists the keys of a proxy passed as a prop and reads
   * every one of them, to diff the props of the component in each commit: the proxy of the render
   * before (a render never lists that one) first, then the new one, before `commit` stops recording.
   * Listing the keys of an earlier view, or of any view outside render, stops recording and warning
   * until the next render or microtask: those reads are not the render's.
   */
  let listing = false

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
      const action = typeof value === "function" && functionSources.has(value)
      const out = action ? probeFor(key, value) : value
      if (!open || listing) {
        // an action needs no subscription: it keeps its identity and runs the latest implementation
        if (!isProduction && !action && !listing && !warned.has(key)) {
          warned.add(key)
          console.warn(outOfRenderWarning(key))
        }
        return out
      }
      reading.seen.set(key, value)
      return out
    },
    has(target, p) {
      if (open && !listing && typeof p !== "symbol") reading.present.set(p as keyof D, Object.hasOwn(target, p))
      return Reflect.has(target, p)
    },
    ownKeys(this: { render?: number }, target) {
      const keys = Reflect.ownKeys(target)
      if (!isProduction && !listing && (!open || this.render !== renders)) {
        listing = true
        queueMicrotask(() => { listing = false })
      }
      if (open && !listing) reading.keys = keys
      return keys
    },
    ...(isProduction ? {} : { set: refuseWrite, deleteProperty: refuseWrite, defineProperty: refuseWrite }),
  }

  /**
   * A fresh Proxy per render, over the same tracker. The React Compiler memoises work on the
   * identity of its inputs: with one long-lived proxy, `helper(store)` would be cached forever and
   * the keys the helper reads would stop being tracked. A new object each render keeps every read
   * observable; the compiler still memoises on the primitive values read out of it.
   */
  const view = () => new Proxy(readable() as any, isProduction ? handler : Object.assign(Object.create(handler), { render: renders })) as { [P in keyof D]?: D[P] | undefined }

  const hasChanged = () => {
    const current = data()
    for (const [key, value] of committed.seen) {
      if (!Object.is(value, current[key])) return true
    }
    for (const [key, latest] of committed.called) {
      if (latestOf(current[key]) !== latest) return true
    }
    // usually empty: skip them without creating an iterator (this runs for every reader on every change)
    if (committed.present.size > 0) {
      for (const [key, present] of committed.present) {
        if (Object.hasOwn(current, key) !== present) return true
      }
    }
    return !!committed.keys && !sameKeys(committed.keys, Reflect.ownKeys(current))
  }

  /** A render that read every key it listed spread the state: it re-renders on every change. */
  const warnIfSpread = () => {
    const { keys, seen } = committed
    if (isProduction || !ctx || !keys || keys.length === 0 || warnedRest.has(ctx.name)) return
    if (!keys.every(key => seen.has(key as keyof D))) return
    warnedRest.add(ctx.name)
    console.warn(restWarning(ctx.name))
  }

  const check = () => {
    if (hasChanged()) {
      version++
      listeners.forEach(l => l())
    }
  }

  let plan: Scheduler = SYNC
  let task = plan.task(check)
  /** Waiting for the store's first data, which is checked at once whatever the schedule. */
  let offReady: (() => void) | undefined

  /**
   * A store publishes its first data just before it is marked ready, in the same layout effect: a
   * scheduled reader whose render on screen came before that checks when it becomes ready.
   */
  const watchReady = () => {
    if (!ctx || plan === SYNC || committed.ready || offReady) return
    if (ctx.ready) return check()
    offReady = ctx.onReady(() => {
      offReady = undefined
      check()
    })
  }

  /** Check now, or ask the schedule for a check. */
  const changed = () => {
    if (plan === SYNC) check()
    else task.request()
  }

  /** The context revision last checked from a notification, and whether commit() is subscribing. */
  let checkedRevision = -1
  let subscribing = false

  /**
   * The listener of every subscription. One update notifies once per changed key (a collection
   * update changes them all), with the data already complete, so one check per revision is enough:
   * each check compares every committed read, which made such an update O(keys x reads).
   * While commit() subscribes, `subscribe` reports each key at once: commit() checks once after.
   */
  const onChange = () => {
    if (subscribing || ctx!.revision === checkedRevision) return
    checkedRevision = ctx!.revision
    changed()
  }

  return {
    view,
    /** Called at the start of every render: reopen the getter and start recording this render's reads. */
    beginRender(snapshot: number) {
      // what the server rendered from: stores never run there, so every key reads undefined
      rendering = snapshot === FROM_SERVER ? {} : undefined
      open = true
      listing = false
      renders++
      rendered = true
      reading.seen.clear()
      reading.called.clear()
      reading.present.clear()
      reading.keys = undefined
      reading.ready = ctx?.ready ?? false
    },
    /**
     * Called after every commit: close the getter, make the committed render's reads current and sync
     * key subscriptions to them. When effects re-run without a new render (StrictMode on mount), it
     * resubscribes what is on screen after `dispose`. `next` is the schedule the render asked for.
     */
    commit(next: Scheduler) {
      open = false
      if (next !== plan) {
        task.cancel()
        plan = next
        task = plan.task(check)
      }
      rendering = undefined
      if (rendered) {
        rendered = false
        const shown = reading
        reading = committed
        committed = shown
      }
      if (ctx) {
        subscribing = true
        for (const key of committed.seen.keys()) {
          if (!subs.has(key)) subs.set(key, ctx.subscribe(key, onChange))
        }
        if (committed.present.size > 0) {
          for (const key of committed.present.keys()) {
            if (!subs.has(key)) subs.set(key, ctx.subscribe(key, onChange))
          }
        }
        // a key added or removed changes the list: watch every change while a list is on screen
        if (committed.keys && !subAll) subAll = ctx.subscribeAll(onChange)
        subscribing = false
      }
      for (const [key, unsub] of subs) {
        if (!committed.seen.has(key) && !committed.present.has(key)) {
          unsub()
          subs.delete(key)
        }
      }
      if (!committed.keys && subAll) {
        subAll()
        subAll = undefined
      }
      warnIfSpread()
      // catch anything published between render and commit (onReady checks at once when it is ready);
      // a schedule is asked only for a real change: a throttle would spend its window on nothing
      watchReady()
      if (plan === SYNC) check()
      else if (hasChanged()) task.request()
    },
    dispose() {
      task.cancel()
      offReady?.()
      offReady = undefined
      subs.forEach(unsub => unsub())
      subs.clear()
      subAll?.()
      subAll = undefined
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getSnapshot: () => version,
    /**
     * Used by React on the server and while hydrating. A component hydrating after the store has
     * published (another island or Suspense boundary started it) renders what the server rendered
     * first, an empty state, then React re-renders it with the live data.
     */
    getServerSnapshot: () => {
      serverSnapshot ??= hasValues(data() as Record<PropertyKey, unknown>) ? FROM_SERVER : version
      return serverSnapshot
    },
  }
}

export type Tracker<D> = ReturnType<typeof createTracker<D>>

/**
 * The proxy form of `useStore`: subscribes to the properties of a context's data that the component reads.
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
  /** When the component re-renders for a change: `frame()`, `throttle(ms)`, ... (default at once). */
  schedule?: Scheduler
): {
    [P in keyof D]?: D[P] | undefined;
  } => {

  const tracker = useMemo(() => createTracker(ctx), [ctx])
  const plan = schedulerOf(schedule)

  const snapshot = useSyncExternalStore(tracker.subscribe, tracker.getSnapshot, tracker.getServerSnapshot)
  tracker.beginRender(snapshot)

  // no deps: subscriptions must follow the keys read in *every* render
  useEffect(() => { tracker.commit(plan) })

  useEffect(() => () => tracker.dispose(), [tracker])

  return tracker.view()
};
