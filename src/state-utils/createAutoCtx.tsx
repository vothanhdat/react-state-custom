import React, { Suspense, useEffect, useCallback, useRef, useId, useContext, memo, useSyncExternalStore } from "react"
import { useDataContext, useDataSelector, acquireContext, getContext, isServer, StateScopeContext, useIsomorphicLayoutEffect, type Context } from "./ctx"
import { createRootCtx } from "./createRootCtx"
import { paramsToId, type ParamsToIdRecord, type StoreParamsShape } from "./paramsToId"
import { useQuickSubscribe } from "./useQuickSubscribe"
import { isProduction, formatState } from "./utils"

/**
 * Renders one store instance's state when `debugging` is on. `name` is the instance key,
 * `"<store>?<params>"`, and `value` the object the store hook returned.
 */
export type StateDebugRenderer = React.ComponentType<{ name: string, value: Record<string, unknown> }>

/** Default `debugging` renderer: the state as JSON text, tagged with the store key for tests to find. */
const DebugState: StateDebugRenderer = ({ name, value }) => <pre data-store={name}>{formatState(value)}</pre>

/**
 * Name a component for React DevTools. The published package is minified, so function and class
 * names come out mangled or empty; a displayName survives. For a memo component, name the function
 * it wraps: that is the type DevTools reads.
 */
const named = <T extends Function>(displayName: string, component: T): T => Object.assign(component, { displayName })

type RunnerProps = { name: string, useStateFn: Function, params: ParamsToIdRecord, debugging: boolean | StateDebugRenderer }

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
    const StoreRunner = ({ name, useStateFn, params, debugging }: RunnerProps) => {
      const state = useStateFn(params)
      if (!debugging) return null
      const Debug = debugging === true ? DebugState : debugging
      return <Debug name={name} value={state} />
    }
    runner = memo(named(`Store(${storeName})`, StoreRunner))
    runners.set(storeName, runner)
  }
  return runner
}

/**
 * Default Wrapper: an error boundary that isolates one crashing store from the others.
 * Without it a single throwing store hook would unmount the whole AutoRootCtx tree.
 * The crashed store renders nothing until it is unmounted (last consumer leaves) and
 * re-created. Pass your own `Wrapper` to AutoRootCtx to customise this.
 */
export class StoreErrorBoundary extends React.Component<{ children?: React.ReactNode }, { error: unknown }> {
  static displayName = "StoreErrorBoundary"
  state = { error: undefined as unknown }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(
      "[react-state-custom] A store hook threw and has been disabled; other stores keep running. " +
      "Pass a custom Wrapper to <AutoRootCtx /> to handle this differently.",
      error,
      info.componentStack
    )
  }

  render() {
    return this.state.error !== undefined ? null : this.props.children
  }
}


/**
 * Inline docs: createAutoCtx + AutoRootCtx
 *
 * Quick start
 * 1) Mount <AutoRootCtx /> ONCE near your app root. Each store is wrapped in an error boundary by default
 *    (StoreErrorBoundary); pass `Wrapper` to replace it. Example: <AutoRootCtx Wrapper={MyErrorBoundary} />
 *
 * 2) Create auto contexts from your root context factories:
 * ```
 *    const { useCtxState: useTestCtxState } = createAutoCtx(createRootCtx('test-state', stateFn))
 *    const { useCtxState: useOtherCtxState } = createAutoCtx(createRootCtx('other-state', otherFn))
 * ```
 * 3) Use them in components:
 * ```
 *    const ctx = useTestCtxState({ userId })
 *    const { property1, property2 } = useDataSubscribeMultiple(ctx,'property1','property2')
 *    // No need to mount the Root returned by createRootCtx directly — AutoRootCtx manages it for you.
 * ```
 * Notes
 * - AutoRootCtx must be mounted before any useCtxState hooks created by createAutoCtx run.
 * - Wrapper should be an ErrorBoundary-like component that simply renders {children}; no extra providers or layout required.
 * - For each unique params object (by stable stringified key), AutoRootCtx ensures a corresponding Root instance is rendered.
 */

type StoreRecord = {
  /** The name given to createStore, which names the runner component (see runnerFor). */
  storeName: string,
  useStateFn: Function,
  AttatchedComponent: React.FC<any> | undefined
  params: ParamsToIdRecord,
}

/** AutoRootCtx's bookkeeping for one instance: consumers and retainers, and the pending timeToClean removal. */
type StoreBook = {
  counter: number,
  useStateFn: Function,
  timer?: ReturnType<typeof setTimeout>
}

/**
 * Replace (or remove, when `next` is undefined) one record while keeping the object's key order,
 * returning the same `state` object when nothing changed.
 *
 * Key order matters: the records become keyed children of AutoRootCtx. Moving a key (the old
 * `{ ...rest, [key]: value }` pattern) re-places the child's fiber, and React StrictMode re-runs
 * effects of re-placed fibers, which made every consumer unsubscribe/resubscribe and move the key
 * again, an infinite loop.
 */
const setRecord = (state: Record<string, StoreRecord>, key: string, next: StoreRecord | undefined) => {
  if (!(key in state)) {
    return next ? { ...state, [key]: next } : state
  }
  if (next === state[key]) return state
  const out: Record<string, StoreRecord> = {}
  for (const k of Object.keys(state)) {
    if (k !== key) out[k] = state[k]
    else if (next) out[k] = next
  }
  return out
}

const warnedProps = new Set<"Wrapper" | "debugging">()

/**
 * A `Wrapper` defined inline (`Wrapper={({ children }) => ...}`) is a new component type on every
 * render of its parent, so React remounts every store under it and all store state is lost.
 */
const warnUnstableProp = (prop: "Wrapper" | "debugging") => {
  if (warnedProps.has(prop)) return
  warnedProps.add(prop)
  console.error(prop === "Wrapper"
    ? `[react-state-custom] The Wrapper passed to <AutoRootCtx /> (or <StateScopeProvider>) changed identity, so every ` +
      `running store was remounted and lost its state. Define the Wrapper component once at module scope instead of ` +
      `inline. (Right after a hot reload this is expected.)`
    : `[react-state-custom] The debugging renderer passed to <AutoRootCtx /> (or <StateScopeProvider>) changed identity, ` +
      `so every store hook ran again. Define it once at module scope instead of inline.`)
}

/** The AutoRootCtx components mounted per scope (keyed by the scope's "auto-ctx" context), oldest first. */
const mountedRoots = new WeakMap<Context<any>, Function[]>()

const warnedSecondRoot = new WeakSet<Context<any>>()

const warnSecondRoot = (autoCtx: Context<any>) => {
  if (warnedSecondRoot.has(autoCtx)) return
  warnedSecondRoot.add(autoCtx)
  console.error(
    `[react-state-custom] More than one <AutoRootCtx /> is mounted in the same scope. Stores run in the newest ` +
    `one and move whenever one mounts or unmounts, losing their state. Mount AutoRootCtx once near the root; ` +
    `use <StateScopeProvider> for a subtree with its own stores.`
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

const isEmpty = (records: Record<string, StoreRecord>) => {
  for (const _ in records) return false
  return true
}

/**
 * The records of one AutoRootCtx, split into buckets that are each an external store for one Bucket.
 * Only buckets holding a record are rendered: `used` lists them and changes only when a bucket
 * fills or empties, so a small app renders a few Buckets instead of 64.
 */
const createBuckets = () => {
  const records: Record<string, StoreRecord>[] = Array.from({ length: BUCKETS }, () => ({}))
  const listeners: Set<() => void>[] = Array.from({ length: BUCKETS }, () => new Set())
  /** Indices of the buckets holding a record, ascending. */
  let used: number[] = []
  const usedListeners = new Set<() => void>()
  return {
    update(key: string, next: (current: StoreRecord | undefined) => StoreRecord | undefined) {
      const i = bucketOf(key)
      const before = records[i]
      const updated = setRecord(before, key, next(before[key]))
      if (updated === before) return
      records[i] = updated
      const empty = isEmpty(updated)
      if (empty !== isEmpty(before)) {
        // ascending, so a bucket coming or going never moves the fibers of the others
        used = empty ? used.filter(j => j !== i) : [...used, i].sort((a, b) => a - b)
        usedListeners.forEach(l => l())
      }
      listeners[i].forEach(l => l())
    },
    subscribe(i: number, listener: () => void) {
      listeners[i].add(listener)
      return () => { listeners[i].delete(listener) }
    },
    get: (i: number) => records[i],
    subscribeUsed(listener: () => void) {
      usedListeners.add(listener)
      return () => { usedListeners.delete(listener) }
    },
    getUsed: () => used,
  }
}

type Buckets = ReturnType<typeof createBuckets>

const Bucket = memo(named("Bucket", function Bucket({ index, buckets, Wrapper, debugging }: {
  index: number,
  buckets: Buckets,
  Wrapper: React.ComponentType<{ children?: React.ReactNode }>,
  debugging: boolean | StateDebugRenderer,
}) {
  const subscribe = useCallback((listener: () => void) => buckets.subscribe(index, listener), [buckets, index])
  const getSnapshot = useCallback(() => buckets.get(index), [buckets, index])
  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return <>
    {Object
      .entries(records)
      // stable order so existing store fibers are never re-placed when records are added/removed
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, record]) => <StoreInstance key={key} name={key} record={record} Wrapper={Wrapper} debugging={debugging} />)}
  </>
}))

type StoreFailureProps = {
  ctx: Context<any>
  useStateFn: Function
  /** The store's runner element, remounted after a hot update that changed its hooks. */
  runner: React.ReactNode
  attached: React.ReactNode
}

type StoreFailureState = {
  error: { value: unknown } | undefined
  /** Key of the runner's Suspense boundary: a new one mounts the hook fresh. */
  generation: number
  /** The hook last restarted this way, so a hook that keeps failing is restarted only once. */
  retried: Function | undefined
}

/**
 * The error boundary of one store instance.
 *
 * A hot update can replace the hook of a running instance, and AutoRootCtx runs the new hook in
 * place so the store keeps its state across an edit. When the edit added, removed or reordered
 * hooks, the old hook state no longer fits and React throws on the first render ("Rendered more
 * hooks ..."). An error from a hook that has not committed yet therefore remounts the runner, once,
 * warm-started from `preState`.
 *
 * Any other error, or a second one, disables the instance: it is recorded on the context, so
 * `useStoreSuspense` consumers throw it into their own error boundary, then rethrown for the
 * user's `Wrapper`.
 */
class StoreFailure extends React.Component<StoreFailureProps, StoreFailureState> {
  static displayName = "StoreFailure"
  state: StoreFailureState = { error: undefined, generation: 0, retried: undefined }

  /** The hook of the last successful commit. */
  private committed = this.props.useStateFn

  static getDerivedStateFromError(error: unknown) {
    return { error: { value: error } }
  }

  /** The error came from a hook that has not committed yet, which the old hook state may not fit. */
  private restartable() {
    const { useStateFn } = this.props
    return useStateFn !== this.committed && this.state.retried !== useStateFn
  }

  componentDidCatch() {
    // Restart in a new render: within one render a boundary catches only one error, so a restarted
    // hook that throws again would pass this boundary by and never be recorded as a failure.
    if (this.restartable()) {
      const retried = this.props.useStateFn
      this.setState(state => ({ error: undefined, generation: state.generation + 1, retried }))
    }
  }

  componentDidMount() {
    this.committed = this.props.useStateFn
  }

  componentDidUpdate() {
    if (!this.state.error) this.committed = this.props.useStateFn
  }

  render() {
    const { error } = this.state
    if (error) {
      if (this.restartable()) return null
      this.props.ctx.fail(error.value)
      throw error.value
    }
    return <>
      {/* Each store suspends on its own: a store hook calling `use(promise)` or a suspense query would
          otherwise suspend the boundary above AutoRootCtx and hide the whole app. A suspended store
          has not published yet (or keeps its last values); consumers wait with useStoreSuspense. */}
      <Suspense key={this.state.generation} fallback={null}>{this.props.runner}</Suspense>
      {this.props.attached}
    </>
  }
}

/** One running store instance: its hook, its AttachedComponent, the error and Suspense boundaries around them. */
const StoreInstance = memo(named("StoreInstance", function StoreInstance({ name, record: { storeName, useStateFn, params, AttatchedComponent }, Wrapper, debugging }: {
  name: string,
  record: StoreRecord,
  Wrapper: React.ComponentType<{ children?: React.ReactNode }>,
  debugging: boolean | StateDebugRenderer,
}) {
  const ctx = useDataContext<any>(name)
  // A failed instance stays failed until it is torn down; the next one starts clean. This component
  // sits outside Wrapper, so it unmounts with the instance and not when Wrapper shows its fallback.
  // StrictMode runs the cleanup and the effect again at once on mount: only a real unmount recovers.
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      queueMicrotask(() => { if (!mounted.current) ctx.recover() })
    }
  }, [ctx])
  const Runner = runnerFor(storeName)
  return <Wrapper>
    <StoreFailure
      ctx={ctx}
      useStateFn={useStateFn}
      runner={<Runner name={name} params={params} useStateFn={useStateFn} debugging={debugging} />}
      attached={AttatchedComponent && <Suspense fallback={null}><AttatchedComponent {...params} /></Suspense>}
    />
  </Wrapper>
}))

export const AutoRootCtx: React.FC<{
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>
  /** Render each store's state into the DOM: `true` for JSON text, or a component receiving `{ name, value }`. */
  debugging?: boolean | StateDebugRenderer
}> = ({ Wrapper = StoreErrorBoundary, debugging = false }) => {

  const ctx = useDataContext<any>("auto-ctx")

  const firstProps = useRef<{ Wrapper: unknown, debugging: unknown } | null>(null)
  useEffect(() => {
    if (isProduction) return
    const previous = firstProps.current
    firstProps.current = { Wrapper, debugging }
    if (!previous) return
    if (previous.Wrapper !== Wrapper) warnUnstableProp("Wrapper")
    if (typeof debugging === "function" && previous.debugging !== debugging) warnUnstableProp("debugging")
  }, [Wrapper, debugging])

  // What to render, one record per running instance, spread over buckets. Changes only when an
  // instance starts or stops, and then re-renders only that instance's bucket.
  const buckets = useRef<Buckets | null>(null)
  buckets.current ??= createBuckets()
  const used = useSyncExternalStore(buckets.current.subscribeUsed, buckets.current.getUsed, buckets.current.getUsed)

  // Reference counts and pending `timeToClean` timers, kept out of React state: a consumer mounting
  // or unmounting on an instance that is already running must not re-render anything.
  const books = useRef(new Map<string, StoreBook>()).current

  useEffect(() => () => books.forEach(book => clearTimeout(book.timer)), [books])

  const subscribeRoot = useCallback(
    (contextName: string, useStateFn: Function, params: ParamsToIdRecord, timeToCleanState = 0, AttatchedComponent = undefined) => {

      const recordKey = [contextName, paramsToId(params)].filter(Boolean).join("?")
      const records = buckets.current!
      const book = books.get(recordKey)

      if (book) {
        if (!isProduction && book.counter > 0 && book.useStateFn !== useStateFn) warnDuplicateName(contextName)
        // a consumer came back during timeToClean: keep the instance
        clearTimeout(book.timer)
        book.timer = undefined
        book.counter += 1
        if (book.useStateFn !== useStateFn) {
          // a new hook for the same name (hot reload): run it in place of the old one
          book.useStateFn = useStateFn
          records.update(recordKey, current => current && { ...current, useStateFn, AttatchedComponent })
        }
      } else {
        books.set(recordKey, { counter: 1, useStateFn })
        records.update(recordKey, () => ({ storeName: contextName, useStateFn, params, AttatchedComponent }))
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
          books.delete(recordKey)
          records.update(recordKey, () => undefined)
        }
        if (timeToCleanState > 0) current.timer = setTimeout(remove, timeToCleanState)
        else remove()
      }

    },
    [books]
  )

  // Offer this root to the scope's consumers. With several roots in one scope (a mistake, reported in
  // development) the newest runs the stores, and when it unmounts the previous one takes over again
  // instead of leaving consumers attached to an unmounted root.
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
    {used.map(i => <Bucket key={i} index={i} buckets={buckets.current!} Wrapper={Wrapper} debugging={debugging} />)}
  </>

}

AutoRootCtx.displayName = "AutoRootCtx"

/**
 * Development check for `useStore`: the proxy and the selector form run different hooks, so a call
 * site that passes a selector on some renders only (`cond ? sel : undefined`, which TypeScript
 * rejects) would break the hook order with an error that does not name the cause. Throw one that does.
 */
const useSelectorModeCheck = (name: string, withSelector: boolean) => {
  const first = useRef(withSelector)
  if (first.current === withSelector) return
  throw new Error(
    `[react-state-custom] useStore("${name}") was called with a selector ${first.current ? "before" : "on this render"} ` +
    `and without one ${first.current ? "on this render" : "before"}. Each form runs different hooks, so a call site ` +
    `must always pass a selector or never. Use two components, or a selector that handles both cases.`
  )
}

/** Options accepted by createStore / createAutoCtx (a bare number is still accepted as `timeToClean`). */
export type StoreOptions<U extends StoreParamsShape<U>, V extends object, I extends Partial<V> = {}> = {
  /** Milliseconds to keep the store alive after its last consumer unmounts. Default 0. */
  timeToClean?: number
  /** Component rendered next to the store root, once per store instance (side effects, logging, ...). */
  AttachedComponent?: React.ComponentType<U>
  /**
   * Values consumers read before the store hook has published its first result.
   * Keys listed here are typed as always present on the `useStore` result.
   * May be a function of the params.
   */
  initialState?: I | ((params: U) => I)
}

/** `useStore(params)`: `params` can be omitted when the store has no required params. */
export type StoreParams<U> = {} extends U ? [params?: U] : [params: U]

/** What `useStore` returns: every key optional, except those guaranteed by `initialState`. */
export type StoreState<V, I> = { [P in keyof V]?: V[P] | undefined } & { [P in keyof I & keyof V]: V[P] }

const normalizeOptions = <U extends StoreParamsShape<U>, V extends object, I extends Partial<V>>(
  timeToCleanOrOptions: number | StoreOptions<U, V, I> | undefined,
  AttatchedComponent: React.ComponentType<U> | undefined
): Required<Pick<StoreOptions<U, V, I>, "timeToClean">> & Omit<StoreOptions<U, V, I>, "timeToClean"> => {
  if (typeof timeToCleanOrOptions === "object") {
    return { timeToClean: 0, AttachedComponent: AttatchedComponent, ...timeToCleanOrOptions }
  }
  return { timeToClean: timeToCleanOrOptions ?? 0, AttachedComponent: AttatchedComponent }
}

/** Contexts that already received their initialState (one seeding per Context instance). */
const seededContexts = new WeakSet<Context<any>>()

/** The imperative handle returned by `getStore(params)`. */
export type StoreHandle<V, I> = {
  /** Context name of this store instance (`name?params`). */
  readonly name: string
  /** Snapshot of the current state: a plain object, safe to read anywhere (handlers, sockets, tests). */
  get(): StoreState<V, I>
  /**
   * Run `listener` after every change, with the new snapshot and the key that changed.
   * Keeps the context alive while subscribed. Returns an unsubscribe function.
   */
  subscribe(listener: (state: StoreState<V, I>, changedKey: keyof V) => void): () => void
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
 * createAutoCtx
 *
 * Bridges a Root context (from createRootCtx) to the global AutoRootCtx renderer.
 * You do NOT mount the Root component yourself — just mount <AutoRootCtx /> once at the app root.
 *
 * Usage:
 * ```
 *    const { useCtxState: useTestCtxState } = createAutoCtx(createRootCtx(
 *      'test-state',
 *      stateFn
 *    ))
 * ```
 *
 * Then inside components:
 * ```
 *   const ctxState = useTestCtxState({ any: 'params' })
 * ```
 * AutoRootCtx will subscribe/unsubscribe instances per unique params and render the appropriate Root under the hood.
 */
export const createAutoCtx = <U extends StoreParamsShape<U>, V extends object, I extends Partial<V> = {}>(
  { useRootState, getCtxName, name }: ReturnType<typeof createRootCtx<U, V>>,
  timeToCleanOrOptions: number | StoreOptions<U, V, I> = 0,
  AttatchedComponent: React.ComponentType<U> | undefined = undefined
) => {
  const { timeToClean, AttachedComponent, initialState } = normalizeOptions(timeToCleanOrOptions, AttatchedComponent)

  const scoped = (scopeId: string | null, ctxName: string) => scopeId ? `${scopeId}/${ctxName}` : ctxName

  const seedValues = (params: U): Partial<V> | undefined => {
    if (!initialState) return undefined
    return (typeof initialState === "function" ? initialState(params) : initialState) as Partial<V>
  }

  // Seed initialState once per Context instance, before anything subscribes, so the very
  // first render already sees values instead of undefined. No event is dispatched.
  const seedContext = (ctx: Context<V>, params: U) => {
    if (!initialState || seededContexts.has(ctx)) return
    seededContexts.add(ctx)
    const seed = seedValues(params)!
    for (const key of Object.keys(seed) as (keyof V)[]) {
      if (!Object.hasOwn(ctx.data, key)) ctx.data[key] = seed[key]
    }
  }

  const missingRootMessage = (ctxName: string) =>
    `[react-state-custom] Store "${ctxName}" is used but no <AutoRootCtx /> (or <StateScopeProvider>) is mounted, ` +
    `so its state hook never runs. Mount <AutoRootCtx /> once near your app root.`

  /**
   * Ask the scope's AutoRootCtx to run the store hook for `params`, as soon as it has published its
   * `subscribe` function (it may still be mounting in the same pass). Returns a release function.
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
      release = subscribe ? subscribe(name, useRootState, params, timeToClean, AttachedComponent) : undefined
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
   * Mount the store (through the scope's AutoRootCtx) without a React consumer, and keep its
   * context alive, until the returned release function is called.
   */
  const retainStore = (scopeId: string | null, params: U) => {
    const auto = acquireContext<any>(scoped(scopeId, "auto-ctx"))
    const store = acquireContext<V>(scoped(scopeId, getCtxName(params)))
    seedContext(store.ctx, params)
    const unmount = mountStore(auto.ctx, store.ctx.name, params)
    return () => {
      unmount()
      store.release()
      auto.release()
    }
  }

  const useCtxState = (...args: StoreParams<U>): Context<V> => {
    const e = (args[0] ?? {}) as U
    const ctxName = getCtxName(e)

    const autoCtx = useDataContext<any>("auto-ctx")
    const ctx = useDataContext<V>(ctxName)
    seedContext(ctx, e)

    useEffect(
      () => mountStore(autoCtx, ctx.name, e),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [autoCtx, ctx]
    )

    return ctx
  }

  /**
   * Imperative access for code that lives outside React (socket handlers, routers, tests) and for
   * event handlers that want the latest value without subscribing. Global scope only: stores inside
   * a `StateScopeProvider` are reachable from their components through `useCtxState`.
   */
  const getStore = (...args: StoreParams<U>): StoreHandle<V, I> => {
    const params = (args[0] ?? {}) as U
    const ctxName = getCtxName(params)
    const snapshot = (ctx: Context<V> | undefined): StoreState<V, I> =>
      ({ ...(seedValues(params) ?? {}), ...(ctx?.data ?? {}) }) as StoreState<V, I>
    const live = () => isServer() ? undefined : getContext.fromCache(ctxName) as Context<V> | undefined

    return {
      name: ctxName,
      get: () => snapshot(live()),
      get ready() { return live()?.ready ?? false },
      get error() { return live()?.error },
      subscribe: (listener) => {
        const { ctx, release } = acquireContext<V>(ctxName)
        seedContext(ctx, params)
        const unsub = ctx.subscribeAll((changedKey) => listener(snapshot(ctx), changedKey))
        return () => { unsub(); release() }
      },
      retain: () => retainStore(null, params),
    }
  }

  /** What the server rendered for these params: consumers read it while hydrating (see useQuickSubscribe). */
  const serverValues = (params: U) => () => (seedValues(params) ?? {}) as Partial<V>

  /**
   * `useStore(params?)` returns a tracking proxy: re-render only for the keys read during render.
   * `useStore(params, selector, isEqual?)` returns `selector(state)` and re-renders only when that
   * value changes: use it for deep reads (`s => s.user?.name`) and derived values.
   */
  function useStore(...args: StoreParams<U>): StoreState<V, I>
  function useStore<R>(params: U | undefined, selector: (state: StoreState<V, I>) => R, isEqual?: (a: R, b: R) => boolean): R
  function useStore(...args: any[]) {
    const [params, selector, isEqual] = args as [U | undefined, ((state: StoreState<V, I>) => unknown)?, ((a: unknown, b: unknown) => boolean)?]
    const ctx = useCtxState(params as any)
    const server = serverValues((params ?? {}) as U)
    const withSelector = typeof selector === "function"
    // isProduction never changes at runtime, so this conditional hook keeps a stable order
    if (!isProduction) useSelectorModeCheck(ctx.name, withSelector)
    // The two modes run different hooks: a call site must always pass a selector or never.
    return withSelector
      ? useDataSelector(ctx, selector as (data: Partial<V>) => unknown, isEqual, server)
      : useQuickSubscribe(ctx, server) as StoreState<V, I>
  }

  /**
   * Like `useStore`, but suspends (throws a promise for the nearest `<Suspense>`) until the store
   * hook has published its first result, or until `isReady(state)` returns true when given.
   * The result is typed as the full state: nothing is `undefined` anymore.
   * While suspended the store is kept mounted imperatively, so it keeps running even though the
   * suspended component has not committed.
   */
  const useStoreSuspense = (...args: [...StoreParams<U>, isReady?: (state: StoreState<V, I>) => boolean]): V => {
    const [params, isReady] = args as unknown as [U | undefined, ((state: StoreState<V, I>) => boolean)?]
    const scopeId = useContext(StateScopeContext)
    const ctx = useCtxState(params as any)
    // The instance this component has already rendered ready (it only suspends on first load)
    const readyFor = useRef<Context<V> | null>(null)
    // A store hook that threw is disabled: hand its error to this component's error boundary,
    // whether it failed before the first result or later.
    // stores never run on the server, so the server (and hydration) snapshot is "not failed"
    const failed = useSyncExternalStore(ctx.onStatus, () => ctx.failed, () => false)
    if (failed) throw ctx.error
    // With a predicate, readiness is the predicate alone (initialState may already satisfy it);
    // without one, readiness means the store hook has published once. Once ready for this instance,
    // the component never suspends again: a refetch turning the predicate false would otherwise swap
    // committed content for the fallback, in an urgent update no transition can hold.
    const ready = readyFor.current === ctx || (isReady ? isReady(ctx.data as StoreState<V, I>) : ctx.ready)
    if (!ready) {
      if (isServer()) {
        throw new Error(
          `[react-state-custom] useStoreSuspense("${ctx.name}") cannot resolve on the server: store hooks only run on the client. ` +
          `Render it inside a client-only boundary, or pass an initialState and an isReady predicate it satisfies.`
        )
      }
      throw waitUntilReady(ctx, isReady, () => retainStore(scopeId, (params ?? {}) as U))
    }
    // React may wait a while before committing a resolved boundary (it throttles reveals after a
    // fallback). Keep the retain taken while suspended until then, and drop it once this component has
    // committed: useCtxState's effect, declared above, has subscribed by the time this one runs.
    readyFor.current = ctx
    extendHeldRetain(ctx)
    useEffect(() => releaseHeldRetain(ctx), [ctx])
    return useQuickSubscribe(ctx, serverValues((params ?? {}) as U)) as V
  }

  return {
    useCtxState,
    useStore,
    useStoreSuspense,
    getStore,
  }
}

type PendingReady<V, I> = {
  promise: Promise<void>
  /** Latest predicate passed by the suspended component (undefined = wait for the first publish). */
  isReady: ((state: StoreState<V, I>) => boolean) | undefined
  check: () => void
}

/** One pending wait per context, shared by every render that suspends on it (StrictMode, retries). */
const pendingReady = new WeakMap<Context<any>, PendingReady<any, any>>()

/**
 * Imperative retains taken while a component was suspended, kept after the promise resolves until a
 * component reading the store commits. React throttles revealing a resolved Suspense boundary (300 ms
 * in React 19, 500 ms in React 18), so a short fixed delay could tear the store down before anyone
 * subscribed, and the commit would then mount a fresh instance and suspend again.
 */
const heldRetains = new WeakMap<Context<any>, { release: () => void, timer: ReturnType<typeof setTimeout> }>()

/** Safety net for a resolved render that never commits: release this long after its last render. */
const RETAIN_UNTIL_COMMIT = 1000

const releaseHeldRetain = (ctx: Context<any>) => {
  const held = heldRetains.get(ctx)
  if (!held) return
  heldRetains.delete(ctx)
  clearTimeout(held.timer)
  held.release()
}

const holdRetain = (ctx: Context<any>, release: () => void) => {
  releaseHeldRetain(ctx)
  heldRetains.set(ctx, { release, timer: setTimeout(() => releaseHeldRetain(ctx), RETAIN_UNTIL_COMMIT) })
}

/** Restart the safety timer: called from each ready render, which proves the boundary is still trying to commit. */
const extendHeldRetain = (ctx: Context<any>) => {
  const held = heldRetains.get(ctx)
  if (!held) return
  clearTimeout(held.timer)
  held.timer = setTimeout(() => releaseHeldRetain(ctx), RETAIN_UNTIL_COMMIT)
}

/**
 * Returns a promise that resolves when `ctx` is ready (see useStoreSuspense). The store is retained
 * imperatively in a microtask, never during render: calling AutoRootCtx's setState from inside a
 * render would restart that render, which would retain again, forever.
 */
const waitUntilReady = <V, I>(
  ctx: Context<V>,
  isReady: ((state: StoreState<V, I>) => boolean) | undefined,
  retain: () => () => void
): Promise<void> => {
  const existing = pendingReady.get(ctx)
  if (existing) {
    existing.isReady = isReady as PendingReady<any, any>['isReady']
    existing.check()
    return existing.promise
  }

  const pending: PendingReady<V, I> = { isReady, check: () => { }, promise: Promise.resolve() }
  pending.promise = new Promise<void>(resolve => {
    let done = false
    let release: (() => void) | undefined
    let unsubAll = () => { }
    let unsubReady = () => { }
    let unsubStatus = () => { }
    pending.check = () => {
      if (done) return
      const fn = pending.isReady
      // a failure resolves the wait too: the retried render throws the store's error
      if (!ctx.failed && !(fn ? fn(ctx.data as StoreState<V, I>) : ctx.ready)) return
      done = true
      unsubAll()
      unsubReady()
      unsubStatus()
      pendingReady.delete(ctx)
      resolve()
      if (release) holdRetain(ctx, release)
    }
    queueMicrotask(() => {
      if (done) return
      release = retain()
      unsubAll = ctx.subscribeAll(pending.check)
      unsubReady = ctx.onReady(pending.check)
      unsubStatus = ctx.onStatus(pending.check)
      pending.check()
    })
  })
  pendingReady.set(ctx, pending as PendingReady<any, any>)
  return pending.promise
}

/**
 * createStore
 *
 * One-step helper: `createRootCtx` + `createAutoCtx`.
 * ```
 * const { useStore } = createStore('counter', useCounterState)
 * const { useStore } = createStore('user', useUserState, { timeToClean: 5000, initialState: { user: null } })
 * ```
 * The third argument may be a bare number (`timeToClean`) for backwards compatibility.
 */
export const createStore = <U extends StoreParamsShape<U>, V extends object, I extends Partial<V> = {}>(
  name: string,
  useFn: (params: U, preState: Partial<V>) => V,
  timeToCleanOrOptions: number | StoreOptions<U, V, I> = 0,
  AttatchedComponent: React.ComponentType<U> | undefined = undefined
) => {
  return createAutoCtx<U, V, I>(createRootCtx(name, useFn), timeToCleanOrOptions, AttatchedComponent)
}

export const StateScopeProvider: React.FC<{
  children: React.ReactNode
  Wrapper?: React.ComponentType<{ children?: React.ReactNode }>
  debugging?: boolean | StateDebugRenderer
}> = ({ children, Wrapper, debugging }) => {
  const scopeId = useId()
  return <StateScopeContext.Provider value={scopeId}>
    <AutoRootCtx Wrapper={Wrapper} debugging={debugging} />
    {children}
  </StateScopeContext.Provider>
}

StateScopeProvider.displayName = "StateScopeProvider"
