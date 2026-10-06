import * as React from "react"
import { Suspense, useEffect, useCallback, useRef, useState, memo, useSyncExternalStore } from "react"
import { useDataContext, acquireContext, getContext, isServer, useIsomorphicLayoutEffect, contextForRender, holdContext, createSelection, useSelected, type Context, type Selection } from "./ctx"
import { createRootCtx } from "./createRootCtx"
import type { ParamsToIdRecord, StoreParamsShape } from "./paramsToId"
import { createReading, useReading, type Reading } from "./useQuickSubscribe"
import { DependencyTracker, isProduction, shallowEqual } from "./utils"
import { storeEntries, storeRefs } from "./storeRegistry"
import { schedulerOf, type Scheduler } from "./schedule"

/**
 * Name a component for React DevTools. The published package is minified, so function and class
 * names come out mangled or empty; a displayName survives. For a memo component, name the function
 * it wraps: that is the type DevTools reads.
 */
const named = <T extends Function>(displayName: string, component: T): T => Object.assign(component, { displayName })

type RunnerProps = { useStateFn: Function, params: ParamsToIdRecord }

/** The runner component of each store name (see runnerFor). */
const runners = new Map<string, React.ComponentType<RunnerProps>>()

/**
 * The component that runs a store's hook. Memoized so that its bucket re-rendering (an instance
 * next to it starting or stopping) does not re-run this hook.
 *
 * One component per store name, so React DevTools shows the instances of "todos" as `Store(todos)`
 * and its search finds them. Keyed by name, not by hook: a hot update brings a new hook for the
 * same name, and a new component type would remount the store on every edit. The map holds one
 * entry per store name the app defines.
 */
const runnerFor = (storeName: string) => {
  let runner = runners.get(storeName)
  if (!runner) {
    const StoreRunner = ({ useStateFn, params }: RunnerProps) => {
      useStateFn(params)
      return null
    }
    runner = memo(named(`Store(${storeName})`, StoreRunner))
    runners.set(storeName, runner)
  }
  return runner
}

type StoreRecord = {
  /** The name given to createStore, which names the runner component (see runnerFor). */
  storeName: string,
  useStateFn: Function,
  params: ParamsToIdRecord,
}

/**
 * The longest delay `setTimeout` waits (2^31 - 1 ms, about 24.8 days). Browsers and Node run a longer
 * one at once, so a `timeToClean` of `Infinity` tore the instance down right away. A `timeToClean`
 * this long or longer keeps the instance until AutoRootCtx unmounts.
 */
const MAX_TIMEOUT = 2 ** 31 - 1

/** What `storeRef(params).get()` returns while nothing holds the instance: always the same empty state. */
const NO_STATE = Object.freeze({})

/** The same keys with `Object.is`-equal values: params that name the same instance without building its name. */
const sameParams = (a: object, b: object) => {
  let keys = 0
  for (const key in a) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false
    keys++
  }
  for (const _ in b) keys--
  return keys === 0
}

/** What one `useStore` call holds: the instance it reads, AutoRootCtx's context, and what its form reads with. */
type Reader<V> = {
  name: string,
  params: object,
  ctx: Context<V>,
  autoCtx: Context<any>,
  reading?: Reading<V>,
  selection?: Selection<V>,
}

/** AutoRootCtx's bookkeeping for one instance: consumers and retainers, and the pending timeToClean removal. */
type StoreBook = {
  counter: number,
  useStateFn: Function,
  timer?: ReturnType<typeof setTimeout>
  /** While the instance waits out its timeToClean: stop waiting for it to fail. */
  unwatch?: () => void
}

/** Records keyed by instance name, without a prototype: any store name is a key of its own. */
type Records = Record<string, StoreRecord>
const createRecords = (): Records => Object.create(null)

/**
 * Replace (or remove, when `next` is undefined) one record while keeping the object's key order,
 * returning the same `state` object when nothing changed.
 *
 * Key order matters: the records become keyed children of AutoRootCtx. Moving a key (the old
 * `{ ...rest, [key]: value }` pattern) re-places the child's fiber, and React StrictMode re-runs
 * effects of re-placed fibers, which made every consumer unsubscribe/resubscribe and move the key
 * again, an infinite loop.
 *
 * Own keys only, into objects without a prototype: a store named `constructor` or `toString` is
 * not already "in" an object, and one named `__proto__` is assigned as a key, not as the prototype.
 */
const setRecord = (state: Records, key: string, next: StoreRecord | undefined) => {
  if (!Object.hasOwn(state, key)) {
    if (!next) return state
    const out = Object.assign(createRecords(), state)
    out[key] = next
    return out
  }
  if (next === state[key]) return state
  const out = createRecords()
  for (const k of Object.keys(state)) {
    if (k !== key) out[k] = state[k]!
    else if (next) out[k] = next
  }
  return out
}

/** The AutoRootCtx components mounted (keyed by the "auto-ctx" context, which resetStores replaces), oldest first. */
const mountedRoots = new WeakMap<Context<any>, Function[]>()

const warnedSecondRoot = new WeakSet<Context<any>>()

const warnSecondRoot = (autoCtx: Context<any>) => {
  if (warnedSecondRoot.has(autoCtx)) return
  warnedSecondRoot.add(autoCtx)
  console.error(
    `[react-state-custom] More than one <AutoRootCtx /> is mounted. Stores run in the newest one and move ` +
    `whenever one mounts or unmounts, losing their state. Mount AutoRootCtx once near the root.`
  )
}

const warnedDuplicateNames = new Set<string>()

/** Two createStore calls with one name share a context and a record, so only one of the hooks would run. */
const warnDuplicateName = (name: string) => {
  if (warnedDuplicateNames.has(name)) return
  warnedDuplicateNames.add(name)
  console.error(
    `[react-state-custom] Two different stores are named "${name}". They share one instance and only one of ` +
    `their hooks runs, so both return the same state. Give each createStore call a unique name. ` +
    `(Right after a hot reload this can be a stale module: reload the page.)`
  )
}

/**
 * Number of buckets the running instances are spread over. Starting or stopping an instance
 * re-renders only its bucket, so the cost is O(instances / BUCKETS) instead of O(instances):
 * React diffs a component's whole child list whenever it renders.
 */
const BUCKETS = 64

/** Stable bucket for a record key (FNV-1a), so an instance's fiber never moves between buckets. */
const bucketOf = (key: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193)
  return (h >>> 0) % BUCKETS
}

const isEmpty = (records: Records) => {
  for (const _ in records) return false
  return true
}

/**
 * The records of one AutoRootCtx, split into buckets that are each an external store for one Bucket.
 * Only buckets holding a record are rendered: `used` lists them and changes only when a bucket
 * fills or empties, so a small app renders a few Buckets instead of 64.
 */
const createBuckets = () => {
  const records: Records[] = Array.from({ length: BUCKETS }, createRecords)
  const listeners: Set<() => void>[] = Array.from({ length: BUCKETS }, () => new Set())
  /** Indices of the buckets holding a record, ascending. */
  let used: number[] = []
  const usedListeners = new Set<() => void>()
  return {
    update(key: string, next: (current: StoreRecord | undefined) => StoreRecord | undefined) {
      const i = bucketOf(key)
      const before = records[i]!
      const updated = setRecord(before, key, next(before[key]))
      if (updated === before) return
      records[i] = updated
      const empty = isEmpty(updated)
      if (empty !== isEmpty(before)) {
        // ascending, so a bucket coming or going never moves the fibers of the others
        used = empty ? used.filter(j => j !== i) : [...used, i].sort((a, b) => a - b)
        usedListeners.forEach(l => l())
      }
      listeners[i]!.forEach(l => l())
    },
    subscribe(i: number, listener: () => void) {
      const bucket = listeners[i]!
      bucket.add(listener)
      return () => { bucket.delete(listener) }
    },
    get: (i: number) => records[i]!,
    subscribeUsed(listener: () => void) {
      usedListeners.add(listener)
      return () => { usedListeners.delete(listener) }
    },
    getUsed: () => used,
  }
}

type Buckets = ReturnType<typeof createBuckets>

const Bucket = memo(named("Bucket", function Bucket({ index, buckets }: { index: number, buckets: Buckets }) {
  const subscribe = useCallback((listener: () => void) => buckets.subscribe(index, listener), [buckets, index])
  const getSnapshot = useCallback(() => buckets.get(index), [buckets, index])
  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return <>
    {Object
      .entries(records)
      // stable order so existing store fibers are never re-placed when records are added/removed
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, record]) => <StoreInstance key={key} name={key} record={record} />)}
  </>
}))

type StoreBoundaryProps = {
  ctx: Context<any>
  useStateFn: Function
  /** The store's runner element, remounted after a hot update that changed its hooks. */
  runner: React.ReactNode
}

type StoreBoundaryState = {
  /** The hook threw (any value, `undefined` included) and has not been restarted. */
  failed: boolean
  /** Key of the runner's Suspense boundary: a new one mounts the hook fresh. */
  generation: number
  /** The hook last restarted this way, so a hook that keeps failing is restarted only once. */
  retried: Function | undefined
}

/**
 * The error boundary of one store instance: a store hook that throws stops only that instance, and
 * every other store and the app keep running.
 *
 * A hot update can replace the hook of a running instance, and AutoRootCtx runs the new hook in
 * place so the store keeps its state across an edit. When the edit added, removed or reordered
 * hooks, the old hook state no longer fits and React throws on the first render ("Rendered more
 * hooks ..."). An error from a hook that has not committed yet therefore remounts the runner, once:
 * the store starts over from its own initial state, as a component does after Fast Refresh.
 *
 * Any other error, or a second one, disables the instance until it is torn down: it is recorded on
 * the context, where `storeRef(params).error` reads it, and the components reading the instance throw
 * it for their own error boundary (see useReading and useSelected). Once they are gone AutoRootCtx tears the
 * instance down without waiting for its timeToClean, and a reader that comes back starts a fresh one.
 */
class StoreBoundary extends React.Component<StoreBoundaryProps, StoreBoundaryState> {
  static displayName = "StoreBoundary"
  state: StoreBoundaryState = { failed: false, generation: 0, retried: undefined }

  /** The hook of the last successful commit. */
  private committed = this.props.useStateFn

  static getDerivedStateFromError() {
    return { failed: true }
  }

  /** The error came from a hook that has not committed yet, which the old hook state may not fit. */
  private restartable() {
    const { useStateFn } = this.props
    return useStateFn !== this.committed && this.state.retried !== useStateFn
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Restart in a new render: within one render a boundary catches only one error, so a restarted
    // hook that throws again would pass this boundary by and never be recorded as a failure.
    if (this.restartable()) {
      const retried = this.props.useStateFn
      this.setState(state => ({ failed: false, generation: state.generation + 1, retried }))
      return
    }
    // A falsy value would read as "no error" in storeRef(params).error and in the readers' boundaries
    this.props.ctx.fail(error || new Error(`[react-state-custom] The hook of "${this.props.ctx.name}" threw ${String(error)}`, { cause: error }))
    // React reports the error itself, in production too (onCaughtError); this only explains what follows
    if (!isProduction) console.error(
      `[react-state-custom] A store hook threw: "${this.props.ctx.name}" is disabled until its instance is ` +
      `torn down, and the components reading it throw this error. Other stores keep running.`,
      error,
      info.componentStack
    )
  }

  componentDidMount() {
    this.committed = this.props.useStateFn
    // Mounted on a failed context and running: Fast Refresh remounted this boundary after a failure, or
    // the instance moved here from an AutoRootCtx in another React root where it failed.
    if (!this.state.failed && this.props.ctx.failed) this.props.ctx.recover()
  }

  componentDidUpdate() {
    if (!this.state.failed) this.committed = this.props.useStateFn
  }

  render() {
    if (this.state.failed) return null
    // Each store suspends on its own: a store hook calling `use(promise)` or a suspense query would
    // otherwise suspend the boundary above AutoRootCtx and hide the whole app. A suspended store has
    // not published yet (or keeps its last values).
    return <Suspense key={this.state.generation} fallback={null}>{this.props.runner}</Suspense>
  }
}

/** One running store instance: its hook, inside its own error and Suspense boundaries. */
const StoreInstance = memo(named("StoreInstance", function StoreInstance({ name, record: { storeName, useStateFn, params } }: {
  name: string,
  record: StoreRecord,
}) {
  const ctx = useDataContext<any>(name)
  // A failed instance stays failed until it is torn down; the next one starts clean, and nothing of the
  // torn-down one runs anymore (see Context.retire). This component sits outside the boundary, so it
  // unmounts with the instance and not when the boundary catches.
  // StrictMode runs the cleanup and the effect again at once on mount: only a real unmount retires.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    ctx.instances += 1
    return () => {
      mounted.current = false
      ctx.instances -= 1
      queueMicrotask(() => {
        // another instance may still run here (a store moving between React roots): its state stays
        if (mounted.current || ctx.instances > 0) return
        ctx.recover()
        ctx.retire()
      })
    }
  }, [ctx])
  const Runner = runnerFor(storeName)
  return <StoreBoundary ctx={ctx} useStateFn={useStateFn} runner={<Runner params={params} useStateFn={useStateFn} />} />
}))

/**
 * Runs every store. Mount it once near the root of the app: a store starts here when its first
 * reader asks for it, and stops `timeToClean` ms after its last reader leaves.
 */
export const AutoRootCtx: React.FC = () => {

  const ctx = useDataContext<any>("auto-ctx")

  // What to render, one record per running instance, spread over buckets. Changes only when an
  // instance starts or stops, and then re-renders only that instance's bucket.
  const buckets = useRef<Buckets | null>(null)
  buckets.current ??= createBuckets()
  const used = useSyncExternalStore(buckets.current.subscribeUsed, buckets.current.getUsed, buckets.current.getUsed)

  // Reference counts and pending `timeToClean` timers, kept out of React state: a consumer mounting
  // or unmounting on an instance that is already running must not re-render anything.
  const books = useRef(new Map<string, StoreBook>()).current

  useEffect(() => () => books.forEach(book => {
    clearTimeout(book.timer)
    book.unwatch?.()
  }), [books])

  const subscribeRoot = useCallback(
    (storeName: string, recordKey: string, useStateFn: Function, params: ParamsToIdRecord, timeToClean = 0) => {

      const records = buckets.current!
      const book = books.get(recordKey)

      if (book) {
        if (!isProduction && book.counter > 0 && book.useStateFn !== useStateFn) warnDuplicateName(storeName)
        // a consumer came back during timeToClean: keep the instance
        clearTimeout(book.timer)
        book.timer = undefined
        book.unwatch?.()
        book.unwatch = undefined
        book.counter += 1
        if (book.useStateFn !== useStateFn) {
          // a new hook for the same name (hot reload): run it in place of the old one
          book.useStateFn = useStateFn
          records.update(recordKey, current => current && { ...current, useStateFn })
        }
      } else {
        books.set(recordKey, { counter: 1, useStateFn })
        records.update(recordKey, () => ({ storeName, useStateFn, params }))
      }

      const current = books.get(recordKey)!
      let released = false
      return () => {
        if (released) return
        released = true
        current.counter -= 1
        if (current.counter > 0) return
        const remove = () => {
          if (books.get(recordKey) !== current || current.counter > 0) return
          clearTimeout(current.timer)
          current.unwatch?.()
          current.unwatch = undefined
          books.delete(recordKey)
          records.update(recordKey, () => undefined)
        }
        // A failed instance runs nothing: kept for its timeToClean, it would only make the readers that
        // come back (an error boundary's retry) throw again. Tear it down now, and as soon as it fails
        // while waiting out its timeToClean.
        const ctx = getContext.fromCache(recordKey)
        if (ctx?.failed) return remove()
        if (timeToClean <= 0) return remove()
        if (ctx) current.unwatch = ctx.onStatus(() => { if (ctx.failed) remove() })
        // A timer cannot wait longer than MAX_TIMEOUT: a longer delay (Infinity included) fires at once
        if (timeToClean < MAX_TIMEOUT) current.timer = setTimeout(remove, timeToClean)
      }

    },
    [books]
  )

  // Offer this root to the readers. With several roots mounted (a mistake, reported in development)
  // the newest runs the stores, and when it unmounts the previous one takes over again instead of
  // leaving readers attached to an unmounted root.
  useIsomorphicLayoutEffect(() => {
    let stack = mountedRoots.get(ctx)
    if (!stack) mountedRoots.set(ctx, stack = [])
    if (stack.length > 0 && !isProduction) warnSecondRoot(ctx)
    stack.push(subscribeRoot)
    ctx.publish("subscribe", subscribeRoot)
    return () => {
      stack.splice(stack.lastIndexOf(subscribeRoot), 1)
      ctx.publish("subscribe", stack[stack.length - 1])
    }
  }, [ctx, subscribeRoot])

  return <>
    {used.map(i => <Bucket key={i} index={i} buckets={buckets.current!} />)}
  </>

}

AutoRootCtx.displayName = "AutoRootCtx"

/**
 * Development checks for the arguments of `useStore`: options passed as the params of a store without
 * params (paramsToId would only say that a param is not a primitive), and the 1.x forms that took a
 * selector function, which 2.0 would read as params or as options.
 */
const checkParams = (name: string, params: unknown, options: unknown) => {
  if (typeof params === "function" || typeof options === "function") {
    throw new TypeError(
      `[react-state-custom] useStore("${name}") got a function. A selector goes in the options: ` +
      `useStore(params, { select }), or useStore(undefined, { select }) for a store without params.`
    )
  }
  const { schedule, select } = (params ?? {}) as { schedule?: { task?: unknown }, select?: unknown }
  const option = typeof select === "function" ? "select"
    : typeof schedule === "object" && schedule !== null && typeof schedule.task === "function" ? "schedule"
    : undefined
  if (!option) return
  throw new TypeError(
    `[react-state-custom] useStore("${name}") got { ${option} } as its params. Options come after the params: ` +
    `useStore(undefined, { ${option} }) for a store without params, or useStore(params, { ${option} }).`
  )
}

/** Development check for the options of `createStore`: what 1.x took there and 2.0 no longer does. */
const checkOptions = (name: string, options: unknown, extra: number) => {
  if (typeof options !== "object" || options === null || extra > 0) {
    throw new TypeError(
      `[react-state-custom] createStore("${name}") takes its options as an object: createStore(name, useFn, { timeToClean }). ` +
      `The AttachedComponent argument was removed in 2.0: put the side effect in the store hook.`
    )
  }
  const removed = (["initialState", "AttachedComponent"] as const).filter(key => key in options)
  if (removed.length === 0) return
  throw new TypeError(
    `[react-state-custom] createStore("${name}"): ${removed.join(" and ")} ${removed.length > 1 ? "were" : "was"} removed in 2.0. ` +
    `Readers get undefined until the store has run, so default at the read (const { count = 0 } = useStore()), ` +
    `and put side effects in the store hook. See the migration guide.`
  )
}

/**
 * Development check for `useStore` and `useMultipleStore`: the proxy and the selector form run
 * different hooks, so a call site that passes a selector on some renders only (`cond ? sel : undefined`,
 * which TypeScript rejects) would break the hook order with an error that does not name the cause.
 * Throw one that does. `call` names the call site: `useStore("todos")`.
 */
export const useSelectorModeCheck = (call: string, withSelector: boolean) => {
  const first = useRef(withSelector)
  if (first.current === withSelector) return
  throw new Error(
    `[react-state-custom] ${call} was called with a selector ${first.current ? "before" : "on this render"} ` +
    `and without one ${first.current ? "on this render" : "before"}. Each form runs different hooks, so a call site ` +
    `must always pass a selector or never. Use two components, or a selector that handles both cases.`
  )
}

/** Options of `createStore(name, useFn, options)`. */
export type StoreOptions = {
  /**
   * Milliseconds to keep the store alive after its last consumer unmounts. Default 0. `Infinity`
   * (or any value of 2^31 - 1 or more) keeps it until `AutoRootCtx` unmounts.
   */
  timeToClean?: number
  /**
   * When consumers re-render for a change of this store, unless they pass their own `schedule` to
   * `useStore`: `frame()`, `throttle(ms)`, `debounce(ms, { maxWait })` or `idle(ms)`, imported from
   * `react-state-custom/schedulers` (default: at once). The store itself, `storeRef(params).get()`
   * and actions are never delayed.
   */
  schedule?: Scheduler
}

/** Options of `useStore(params, options)` and `useMultipleStore(refs, options)`. */
export type StoreReadOptions = {
  /**
   * When this component re-renders for a change of the store: `sync()`, `frame()`, `throttle(ms)`,
   * `debounce(ms, { maxWait })` or `idle(ms)`, imported from `react-state-custom/schedulers`.
   * Default: the store's `schedule` option, or at once. Calling the factory on every render is fine:
   * it returns the same scheduler for the same arguments.
   */
  schedule?: Scheduler
}

/**
 * Options of `useStore(params, { select })` and `useMultipleStore(refs, { select })`: the hook
 * returns `select(state)` and re-renders only when that value changes according to `isEqual`.
 */
export type StoreSelect<S, R> = StoreReadOptions & {
  /** Derives the value from the plain state. A new function on every render is fine. */
  select: (state: S) => R
  /**
   * Decides whether the selection changed. Default `shallowEqual`: `Object.is` one level deep, so a
   * fresh array or plain object holding the same items is no change.
   */
  isEqual?: (a: R, b: R) => boolean
}

/** `useStore(params)`: `params` can be omitted when the store has no required params. */
export type StoreParams<U> = {} extends U ? [params?: U] : [params: U]

/** Turns a store hook returning an array or a function into a type error that says what to return. */
type ObjectResult<V> = V extends readonly unknown[] | Function ? "a store hook returns an object of keys, not an array or a function" : unknown

/** What `useStore` returns: every key optional, `undefined` until the store has run once. */
export type StoreState<V> = { [P in keyof V]?: V[P] | undefined }

/**
 * One instance of a store, as `storeRef(params)` returns it: read it and keep it running from code
 * outside React (socket handlers, routers, tests), and read several instances in one component with
 * `useMultipleStore([refA, refB])`.
 */
export type StoreRef<V> = {
  /** Context name of this store instance (`name?params`). */
  readonly name: string
  /**
   * Snapshot of the current state: a plain object, safe to read anywhere (handlers, sockets, tests).
   * The same object until the state changes, so it also serves as a `useSyncExternalStore` snapshot.
   * Shared by every caller, so it is frozen.
   */
  get(): StoreState<V>
  /**
   * Run `listener` after every change, with the new snapshot and the key that changed.
   * Keeps the context alive while subscribed. Returns an unsubscribe function.
   */
  subscribe(listener: (state: StoreState<V>, changedKey: keyof V) => void): () => void
  /**
   * Keep the store running even while no component consumes it (the hook is mounted inside
   * the global `AutoRootCtx`). Returns a release function; the store is torn down after
   * `timeToClean` once every consumer and every retainer is gone.
   */
  retain(): () => void
  /** True once the store hook has published its first result. */
  readonly ready: boolean
  /** What the store hook threw while it is disabled, `undefined` while it runs. Cleared when the instance is torn down. */
  readonly error: unknown
}

/**
 * The `useStore` of a store: `useStore(params?, { schedule }?)` returns a tracking proxy, and
 * `useStore(params, { select, isEqual?, schedule? })` returns the selection.
 */
export interface UseStore<U, V> {
  // the selection first: options without `select` fall through to the proxy
  // params may be undefined only when every param is optional
  <R>(params: {} extends U ? U | undefined : U, options: StoreSelect<StoreState<V>, R>): R
  (...args: [...StoreParams<U>, options?: StoreReadOptions]): StoreState<V>
}

/** What `createStore` returns. */
export type Store<U, V> = {
  /**
   * Read the instance for `params`, starting it if nothing runs it yet. Without `select`, a proxy
   * that re-renders the component only for the keys it read; with `select`, the selected value.
   */
  useStore: UseStore<U, V>
  /** The instance for `params`, outside React or for `useMultipleStore`. */
  storeRef: (...args: StoreParams<U>) => StoreRef<V>
}

/**
 * Turn a hook into a store: one running instance per params, started by its first reader, shared by
 * every reader, and stopped `timeToClean` ms after the last one leaves.
 * ```
 * const { useStore, storeRef } = createStore('counter', useCounterState)
 * const { useStore } = createStore('user', useUserState, { timeToClean: 5000 })
 * ```
 */
export function createStore<U extends StoreParamsShape<U>, V extends object>(
  name: string,
  useFn: (params: U) => V & ObjectResult<V>,
  options: StoreOptions = {},
): Store<U, V> {
  if (!isProduction) checkOptions(name, options, arguments.length - 3)
  const { timeToClean = 0, schedule: defaultSchedule } = options
  const { useRootState, getCtxName } = createRootCtx(name, useFn)

  const missingRootMessage = (ctxName: string) =>
    `[react-state-custom] Store "${ctxName}" is used but no <AutoRootCtx /> is mounted, ` +
    `so its state hook never runs. Mount <AutoRootCtx /> once near your app root.`

  /**
   * Ask AutoRootCtx to run the store hook for `params`, as soon as it has published its `subscribe`
   * function (it may still be mounting in the same pass). Returns a release function.
   * This subscribes to `auto-ctx` directly instead of reading `subscribe` during render, so a
   * consumer never re-renders just because AutoRootCtx came up after it.
   */
  const mountStore = (autoCtx: Context<any>, ctxName: string, params: U) => {
    let active = true
    let release: (() => void) | undefined
    // Fires immediately when AutoRootCtx is already up, and again if it is replaced by a new one.
    const unsub = autoCtx.subscribe("subscribe", (subscribe: Function | undefined) => {
      if (!active) return
      release?.()
      release = subscribe ? subscribe(name, ctxName, useRootState, params, timeToClean) : undefined
    })
    // No AutoRootCtx has published its subscribe fn yet. Give it a moment, then tell the developer
    // instead of failing silently.
    const warning = isProduction || isServer() || release ? undefined : setTimeout(() => {
      if (active && !release) console.error(missingRootMessage(ctxName))
    }, 1000)

    return () => {
      if (!active) return
      active = false
      clearTimeout(warning)
      unsub()
      release?.()
    }
  }

  /**
   * Mount the store (through AutoRootCtx) without a React consumer, and keep its context alive,
   * until the returned release function is called.
   */
  const retainStore = (params: U) => {
    const auto = acquireContext<any>("auto-ctx")
    const store = acquireContext<V>(getCtxName(params))
    const unmount = mountStore(auto.ctx, store.ctx.name, params)
    return () => {
      unmount()
      store.release()
      auto.release()
    }
  }

  /**
   * The instance for `params`, which runs while this component is mounted: its context and AutoRootCtx's
   * stay cached (as useDataContext keeps one), and AutoRootCtx is asked to run it. One state, one ref
   * and one effect for all of it, and the name is built again only when the params change: a reader
   * renders on every change it reads.
   */
  const useReader = (params: U): Reader<V> => {
    const [, adopt] = useState(0)
    const ref = useRef<Reader<V> | null>(null)
    const last = ref.current
    const name = last && sameParams(last.params, params) ? last.name : getCtxName(params)
    if (!isProduction) DependencyTracker.addDependency(name)
    if (!last || last.name !== name) {
      ref.current = { name, params, ctx: contextForRender<V>(name), autoCtx: contextForRender("auto-ctx") }
    }
    const reader = ref.current!

    useEffect(() => {
      const store = holdContext(reader.ctx)
      const root = holdContext(reader.autoCtx)
      if (store.ctx !== reader.ctx || root.ctx !== reader.autoCtx) {
        // someone created a fresh instance in between: adopt it (see useDataContext)
        ref.current = { name, params: reader.params, ctx: store.ctx, autoCtx: root.ctx }
        adopt(n => n + 1)
      }
      const unmount = mountStore(root.ctx, store.ctx.name, reader.params as U)
      return () => {
        unmount()
        reader.reading?.tracker.dispose()
        store.release()
        root.release()
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reader.ctx, reader.autoCtx])

    return reader
  }

  /**
   * The instance for `params`: read it and keep it running from code outside React (socket
   * handlers, routers, tests) or from event handlers that want the latest value without
   * subscribing, and pass it to `useMultipleStore` to read several instances in one component.
   */
  const storeRef = (...args: StoreParams<U>): StoreRef<V> => {
    const params = (args[0] ?? {}) as U
    const ctxName = getCtxName(params)
    const live = () => isServer() ? undefined : getContext.fromCache(ctxName) as Context<V> | undefined

    const ref: StoreRef<V> = {
      name: ctxName,
      get: () => (live()?.snapshot() ?? NO_STATE) as StoreState<V>,
      get ready() { return live()?.ready ?? false },
      get error() { return live()?.error },
      subscribe: (listener) => {
        const { ctx, release } = acquireContext<V>(ctxName)
        // One update calls the listener once per changed key, with the same snapshot
        const unsub = ctx.subscribeAll((changedKey) => listener(ctx.snapshot() as StoreState<V>, changedKey))
        return () => { unsub(); release() }
      },
      retain: () => retainStore(params),
    }
    storeRefs.set(ref, { name: ctxName, retain: () => retainStore(params), schedule: defaultSchedule })
    return ref
  }

  function useStore(...args: unknown[]) {
    const [params, options] = args as [U | undefined, Partial<StoreSelect<unknown, unknown>> | undefined]
    if (!isProduction) checkParams(name, params, options)
    const reader = useReader((params ?? {}) as U)
    const { ctx } = reader
    const selector = options?.select
    const withSelector = typeof selector === "function"
    const schedule = options?.schedule ?? defaultSchedule
    // isProduction never changes at runtime, so this conditional hook keeps a stable order
    if (!isProduction) useSelectorModeCheck(`useStore("${ctx.name}")`, withSelector)
    // The two forms run different hooks: a call site must always pass a selector or never.
    // each form follows failures in its own subscription (see createReading, createSelection)
    if (withSelector) {
      const plan = schedulerOf(schedule)
      if (reader.selection?.plan !== plan) reader.selection = createSelection(ctx, plan)
      return useSelected(reader.selection, selector, options?.isEqual ?? shallowEqual)
    }
    return useReading(reader.reading ??= createReading(ctx), schedule)
  }

  // so that react-state-custom/testing finds this store from whichever of these a module exports
  const entry = { name, storeRef: storeRef as (params?: object) => StoreRef<any> }
  storeEntries.set(useStore, entry)
  storeEntries.set(storeRef, entry)

  return { useStore: useStore as UseStore<U, V>, storeRef }
}
