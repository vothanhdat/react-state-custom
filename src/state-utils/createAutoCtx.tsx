import React, { useEffect, useState, useCallback, useMemo, useId, memo } from "react"
import { useDataContext, useDataSourceMultiple, useDataSubscribe, StateScopeContext, type Context } from "./ctx"
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
 *    const { useCtxState: useOtherCtxState } = createAutoCtx(createRootCtx(
 *      'other-state', 
 *      otherFn
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
        const timeout = setTimeout(() => console.error(
          `[react-state-custom] Store "${ctxName}" is used but no <AutoRootCtx /> (or <StateScopeProvider>) is mounted, ` +
          `so its state hook never runs. Mount <AutoRootCtx /> once near your app root.`
        ), 1000)
        return () => clearTimeout(timeout)
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [useRootState, subscribe, name, ctxName, timeToClean, AttachedComponent]
    )

    const ctx = useDataContext<V>(ctxName)

    // Seed initialState once per Context instance, before anything subscribes, so the very
    // first render already sees values instead of undefined. No event is dispatched.
    if (initialState && !seededContexts.has(ctx)) {
      seededContexts.add(ctx)
      const seed = (typeof initialState === "function" ? initialState(e) : initialState) as Partial<V>
      for (const key of Object.keys(seed) as (keyof V)[]) {
        if (!Object.hasOwn(ctx.data, key)) ctx.data[key] = seed[key]
      }
    }

    return ctx
  }

  return {
    useCtxState,
    useStore: (...args: StoreParams<U>) => useQuickSubscribe(useCtxState(...args)) as StoreState<V, I>
  }
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
