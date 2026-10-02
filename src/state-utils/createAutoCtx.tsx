import React, { useEffect, useState, useCallback, useMemo, useId, useContext, memo } from "react"
import { useDataContext, useDataSourceMultiple, useDataSubscribe, useDataSelector, acquireContext, getContext, isServer, StateScopeContext, type Context } from "./ctx"
import { createRootCtx } from "./createRootCtx"
import { paramsToId, type ParamsToIdRecord } from "./paramsToId"
import { useQuickSubscribe } from "./useQuickSubscribe"
import { isProduction } from "./utils"



const DebugState = ({ }) => <></>

/**
 * Runs one store hook. Memoized so that AutoRootCtx re-rendering (which happens every time
 * any consumer subscribes or unsubscribes) does not re-run every other store's hook.
 */
const StateRunner = memo(function StateRunner({ useStateFn, params, debugging }: { useStateFn: Function, params: ParamsToIdRecord, debugging: boolean }) {
  const state = useStateFn(params)
  return debugging ? <DebugState {...state} /> : <></>
})

/**
 * Default Wrapper: an error boundary that isolates one crashing store from the others.
 * Without it a single throwing store hook would unmount the whole AutoRootCtx tree.
 * The crashed store renders nothing until it is unmounted (last consumer leaves) and
 * re-created. Pass your own `Wrapper` to AutoRootCtx to customise this.
 */
export class StoreErrorBoundary extends React.Component<{ children?: React.ReactNode }, { error: unknown }> {
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
  useStateFn: Function,
  AttatchedComponent: React.FC<any> | undefined
  params: ParamsToIdRecord,
  counter: number,
  keepUntil?: number
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

export const AutoRootCtx: React.FC<{ Wrapper?: React.ComponentType<{ children?: React.ReactNode }>, debugging?: boolean }> = ({ Wrapper = StoreErrorBoundary, debugging = false }) => {

  const ctx = useDataContext<any>("auto-ctx")

  const [state, setState] = useState<Record<string, StoreRecord>>({})


  const subscribeRoot = useCallback(
    (contextName: string, useStateFn: Function, params: ParamsToIdRecord, timeToCleanState = 0, AttatchedComponent = undefined) => {

      const recordKey = [contextName, paramsToId(params)].filter(Boolean).join("?")

      setState(state => {
        const current = state[recordKey]
        return setRecord(state, recordKey, {
          useStateFn,
          params: current?.params ?? params,
          AttatchedComponent,
          counter: (current?.counter ?? 0) + 1,
          keepUntil: undefined,
        })
      })

      return () => setState(state => {
        const current = state[recordKey]
        if (!current) return state
        const counter = current.counter - 1
        if (counter > 0) return setRecord(state, recordKey, { ...current, counter, keepUntil: undefined })
        if (timeToCleanState > 0) return setRecord(state, recordKey, { ...current, counter: 0, keepUntil: Date.now() + timeToCleanState })
        return setRecord(state, recordKey, undefined)
      })

    },
    []
  )

  const nextDelete = useMemo(() => Object.entries(state)
    .filter(([, { counter, keepUntil }]) => counter <= 0 && keepUntil)
    .sort(([, { keepUntil: k1 = 0 }], [, { keepUntil: k2 = 0 }]) => k1 - k2)
    .at(0),
    [state]
  )

  useEffect(() => {
    if (nextDelete) {
      const [key, { keepUntil }] = nextDelete
      if (typeof keepUntil == 'undefined')
        throw new Error("Invalid state mgr")

      let t = setTimeout(() => {
        // console.log("Delay Cleaned")
        setState(({ [key]: _, ...rest }) => rest)
      }, Math.max(0, keepUntil - Date.now()))
      return () => {
        // console.log("Cancel clean")
        clearTimeout(t)
      };
    }
  }, [nextDelete])

  useDataSourceMultiple(ctx,
    ["subscribe", subscribeRoot],
    ["state", state],
  )

  return <>
    {Object
      .entries(state)
      .filter(([, { counter, keepUntil = 0 }]) => counter > 0 || keepUntil >= Date.now())
      // stable order so existing store fibers are never re-placed when records are added/removed
      .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, { useStateFn, params, AttatchedComponent }]) => <Wrapper key={key}>
        <StateRunner key={key} params={params} useStateFn={useStateFn} debugging={debugging} />
        {AttatchedComponent && <AttatchedComponent key={'attatch_' + key} {...params} />}
      </Wrapper>)}
  </>

}

/** Options accepted by createStore / createAutoCtx (a bare number is still accepted as `timeToClean`). */
export type StoreOptions<U extends ParamsToIdRecord, V extends Record<string, unknown>, I extends Partial<V> = {}> = {
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

const normalizeOptions = <U extends ParamsToIdRecord, V extends Record<string, unknown>, I extends Partial<V>>(
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
export const createAutoCtx = <U extends ParamsToIdRecord, V extends Record<string, unknown>, I extends Partial<V> = {}>(
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
   * Mount the store (through the scope's AutoRootCtx) without a React consumer, and keep its
   * context alive, until the returned release function is called.
   */
  const retainStore = (scopeId: string | null, params: U) => {
    const auto = acquireContext<any>(scoped(scopeId, "auto-ctx"))
    const store = acquireContext<V>(scoped(scopeId, getCtxName(params)))
    seedContext(store.ctx, params)

    let active = true
    let release: (() => void) | undefined
    const unsub = auto.ctx.subscribe("subscribe", (subscribe: Function | undefined) => {
      if (subscribe && active && !release) release = subscribe(name, useRootState, params, timeToClean, AttachedComponent)
    })
    const warning = isProduction || isServer() ? undefined : setTimeout(() => {
      if (active && !release) console.error(missingRootMessage(store.ctx.name))
    }, 1000)

    return () => {
      if (!active) return
      active = false
      clearTimeout(warning)
      unsub()
      release?.()
      store.release()
      auto.release()
    }
  }

  const useCtxState = (...args: StoreParams<U>): Context<V> => {
    const e = (args[0] ?? {}) as U
    const ctxName = getCtxName(e)

    const subscribe = useDataSubscribe(useDataContext<any>("auto-ctx"), "subscribe")

    useEffect(
      () => {
        if (subscribe) return subscribe(name, useRootState, e, timeToClean, AttachedComponent)
        if (isProduction) return
        // No AutoRootCtx has published its subscribe fn yet. Give it a moment (it may be
        // mounting in the same pass), then tell the developer instead of failing silently.
        const timeout = setTimeout(() => console.error(missingRootMessage(ctxName)), 1000)
        return () => clearTimeout(timeout)
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [useRootState, subscribe, name, ctxName, timeToClean, AttachedComponent]
    )

    const ctx = useDataContext<V>(ctxName)
    seedContext(ctx, e)
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
      subscribe: (listener) => {
        const { ctx, release } = acquireContext<V>(ctxName)
        seedContext(ctx, params)
        const unsub = ctx.subscribeAll((changedKey) => listener(snapshot(ctx), changedKey))
        return () => { unsub(); release() }
      },
      retain: () => retainStore(null, params),
    }
  }

  const useStoreProxy = (ctx: Context<V>) => useQuickSubscribe(ctx) as StoreState<V, I>

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
    // A given call site always passes a selector or never does, so the hook order is stable.
    return typeof selector === "function"
      ? useDataSelector(ctx, selector as (data: Partial<V>) => unknown, isEqual)
      : useStoreProxy(ctx)
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
    // With a predicate, readiness is the predicate alone (initialState may already satisfy it);
    // without one, readiness means the store hook has published once.
    const ready = isReady ? isReady(ctx.data as StoreState<V, I>) : ctx.ready
    if (!ready) {
      if (isServer()) {
        throw new Error(
          `[react-state-custom] useStoreSuspense("${ctx.name}") cannot resolve on the server: store hooks only run on the client. ` +
          `Render it inside a client-only boundary, or pass an initialState and an isReady predicate it satisfies.`
        )
      }
      throw waitUntilReady(ctx, isReady, () => retainStore(scopeId, (params ?? {}) as U))
    }
    return useQuickSubscribe(ctx) as V
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

/** How long the imperative retain outlives the resolved promise, giving the component time to mount and subscribe itself. */
const RETAIN_AFTER_READY = 100

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
    pending.check = () => {
      if (done) return
      const fn = pending.isReady
      if (!(fn ? fn(ctx.data as StoreState<V, I>) : ctx.ready)) return
      done = true
      unsubAll()
      unsubReady()
      pendingReady.delete(ctx)
      resolve()
      if (release) setTimeout(release, RETAIN_AFTER_READY)
    }
    queueMicrotask(() => {
      if (done) return
      release = retain()
      unsubAll = ctx.subscribeAll(pending.check)
      unsubReady = ctx.onReady(pending.check)
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
export const createStore = <U extends ParamsToIdRecord, V extends Record<string, unknown>, I extends Partial<V> = {}>(
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
  debugging?: boolean
}> = ({ children, Wrapper, debugging }) => {
  const scopeId = useId()
  return <StateScopeContext.Provider value={scopeId}>
    <AutoRootCtx Wrapper={Wrapper} debugging={debugging} />
    {children}
  </StateScopeContext.Provider>
}
