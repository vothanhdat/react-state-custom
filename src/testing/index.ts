// react-state-custom/testing: helpers for tests. Each takes a store by any function `createStore`
// returned for it (`useStore`, `getStore`, `useStoreSuspense`, ...), whichever its module exports.
import { useSyncExternalStore } from "react"
import { acquireContext, getContext, type Context } from "../state-utils/ctx"
import { DependencyTracker } from "../state-utils/utils"
import { storeEntries, storeMocks, type StoreEntry } from "../state-utils/storeRegistry"
import type { StoreHandle, StoreParams, StoreState, StoreStateWith } from "../state-utils/createAutoCtx"

/** A function `createStore` returned. `useStore`, `getStore` and `useStoreSuspense` also carry the store's types. */
export type StoreFunction = (...args: any[]) => any

/**
 * `[params, state, initialState]` of the store behind one of its functions. An overloaded function
 * is matched against both of its overloads, the only way to read the first one; matched against a
 * single signature, its generic last overload would take any return type and match anything.
 */
type TypesOf<F> =
  // getStore (the return type of useStore's selector overload reads as unknown here)
  F extends (...args: infer A) => infer H
    ? H extends StoreHandle<infer V, infer I> ? [Exclude<A[0], undefined>, V, I]
    // useStore: the proxy overload, then the selector one, whose `state` names the types
    : F extends { (...args: infer A): any, <R>(params: any, selector: (state: StoreState<infer V, infer I>) => R, isEqual?: any): R }
      ? unknown extends V ? SuspenseTypesOf<F> : [Exclude<A[0], undefined>, V, I]
    : SuspenseTypesOf<F>
  : Unknown

/** useStoreSuspense: the predicate overload, whose `state` names the types, then the keys one. */
type SuspenseTypesOf<F> =
  F extends { (params: infer P, isReady?: (state: StoreState<infer V, infer I>) => boolean): any, <const K extends readonly any[]>(params: any, keys: K): any }
    ? unknown extends V ? Unknown : [Exclude<P, undefined>, V, I]
    : Unknown

type Unknown = [any, any, {}]

type ParamsOf<F> = TypesOf<F>[0]
type StateOf<F> = TypesOf<F>[1]
type InitialOf<F> = TypesOf<F>[2]

/** The params argument when more arguments follow it: `undefined` is accepted when no param is required. */
type ParamsArg<F> = {} extends ParamsOf<F> ? ParamsOf<F> | undefined : ParamsOf<F>

const entryOf = (store: unknown, caller: string): StoreEntry => {
  const entry = typeof store === "function" ? storeEntries.get(store) : undefined
  if (entry) return entry
  throw new TypeError(
    `[react-state-custom] ${caller}() takes a function returned by createStore (useStore, getStore, useStoreSuspense, ...), ` +
    `got ${typeof store === "function" ? `the function ${store.name || "(anonymous)"}` : String(store)}.`
  )
}

/** Names of the running instances of the store `name`, in any scope (a scope prefixes them with `scope<n>/`). */
const runningInstances = (name: string) => {
  const running: string[] = []
  for (const ctx of getContext.cache.values() as Iterable<Context<unknown>>) {
    const unscoped = ctx.name.replace(/^scope\d+\//, "")
    if (ctx.instances > 0 && (unscoped === name || unscoped.startsWith(`${name}?`))) running.push(ctx.name)
  }
  return running
}

/** The handle `mockStore` returns. */
export type StoreMock<V> = {
  /**
   * Merge `values` over what the mock returns, in every instance running it: they publish the
   * change and their readers re-render. Wrap the call in `act`.
   */
  set(values: Partial<V>): void
  /** Stop mocking. Instances started from now on run the store's own hook; running ones keep the mock. */
  restore(): void
}

/**
 * Replace a store's hook in the instances that start from now on. `mock` is what the store publishes,
 * some of its keys or all of them, or a hook of `(params, preState)` returning them, which may use
 * other hooks. The store's own hook and its `AttachedComponent` do not run; `initialState` and
 * `timeToClean` still apply. Functions are published as actions, so a `vi.fn()` passed here records
 * the calls readers make. Applies in every scope. `resetStores()` removes every mock.
 */
export const mockStore = <F extends StoreFunction>(
  store: F,
  mock: NoInfer<Partial<StateOf<F>> | ((params: ParamsOf<F>, preState: Partial<StateOf<F>>) => Partial<StateOf<F>>)>,
): StoreMock<StateOf<F>> => {
  const { name } = entryOf(store, "mockStore")
  const running = runningInstances(name)
  if (running.length > 0) {
    console.warn(
      `[react-state-custom] mockStore("${name}"): ${running.join(", ")} already running and keep${running.length > 1 ? "" : "s"} ` +
      `the store's own hook. A mock applies to instances that start after it: call mockStore before rendering.`
    )
  }

  let overrides: Partial<StateOf<F>> | undefined
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const getOverrides = () => overrides

  const useMock = (params: ParamsOf<F>, preState: Partial<StateOf<F>>) => {
    const values = typeof mock === "function" ? mock(params, preState) : mock
    const extra = useSyncExternalStore(subscribe, getOverrides, getOverrides)
    return extra ? { ...values, ...extra } : values
  }
  storeMocks.set(name, useMock)

  return {
    set(values) {
      overrides = { ...overrides, ...values }
      listeners.forEach(listener => listener())
    },
    restore() {
      if (storeMocks.get(name) === useMock) storeMocks.delete(name)
    },
  }
}

/**
 * Forget every store: remove the mocks and drop the cached contexts with the state they hold, so the
 * next test starts from nothing. Call it after each test, once the rendered trees are unmounted
 * (after Testing Library's `cleanup`).
 */
export const resetStores = () => {
  storeMocks.clear()
  getContext.cache.clear()
  DependencyTracker.graph.clear()
}

/**
 * The `getStore(params)` handle of a store, from any of its functions: read its state, call its
 * actions, subscribe or `retain()` it, also when its module exports only `useStore`.
 * Global scope only, like `getStore`.
 */
export const storeHandle = <F extends StoreFunction>(store: F, ...args: StoreParams<ParamsOf<F>>): StoreHandle<StateOf<F>, InitialOf<F>> =>
  entryOf(store, "storeHandle").getStore(args[0] as object | undefined)

/** Options of `waitForStore`. */
export type WaitForStoreOptions = {
  /** Milliseconds before the promise rejects. Default 1000, like Testing Library's `waitFor`. */
  timeout?: number
}

/** Waits in progress, and React's act environment flag from before the first of them. */
let waits = 0
let actEnvironment: unknown

/**
 * Testing Library turns on React's act environment, in which an update outside `act` logs a warning.
 * A store updating while a test waits for it is what the test waits for, so the flag is off
 * meanwhile, as in Testing Library's own `waitFor`.
 */
const whileWaiting = async <T>(wait: () => Promise<T>): Promise<T> => {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }
  if (waits++ === 0) {
    actEnvironment = scope.IS_REACT_ACT_ENVIRONMENT
    scope.IS_REACT_ACT_ENVIRONMENT = false
  }
  try {
    return await wait()
  } finally {
    if (--waits === 0) scope.IS_REACT_ACT_ENVIRONMENT = actEnvironment
  }
}

const timeoutMessage = (ctx: Context<object>, timeout: number, state: Record<PropertyKey, unknown>, keys: readonly PropertyKey[] | undefined) => {
  const reason = !ctx.ready && ctx.instances === 0
    ? "no instance of it is running. Render a component that reads it, or keep it running with storeHandle(...).retain()"
    : !ctx.ready ? "it has not published yet"
    : keys ? `still undefined: ${keys.filter(key => state[key] === undefined).map(String).join(", ")}`
    : "isReady still returns false"
  return `[react-state-custom] waitForStore("${ctx.name}") timed out after ${timeout} ms: ${reason}.`
}

/**
 * Wait until the store instance has published (its hook ran), or until `isReady(state)` holds, or
 * until each of `keys` holds a value, which types those keys as present, like `useStoreSuspense`.
 * Resolves with the state; rejects with what the store hook threw if it fails, and after `timeout`.
 * It does not start the store: render a component that reads it, or `retain()` it.
 * Global scope only, like `getStore`.
 */
export function waitForStore<F extends StoreFunction>(store: F, ...args: StoreParams<ParamsOf<F>>): Promise<StoreState<StateOf<F>, InitialOf<F>>>
// the predicate first: checked against the keys overload first, its parameter would get no type
export function waitForStore<F extends StoreFunction>(
  store: F, params: ParamsArg<F>, isReady: NoInfer<((state: StoreState<StateOf<F>, InitialOf<F>>) => boolean) | undefined>, options?: WaitForStoreOptions,
): Promise<StoreState<StateOf<F>, InitialOf<F>>>
export function waitForStore<F extends StoreFunction, const K extends readonly (keyof StateOf<F>)[]>(
  store: F, params: ParamsArg<F>, keys: K, options?: WaitForStoreOptions,
): Promise<number extends K["length"] ? StoreState<StateOf<F>, InitialOf<F>> : StoreStateWith<StateOf<F>, InitialOf<F>, K[number]>>
export function waitForStore(
  store: StoreFunction,
  params?: object,
  until?: readonly PropertyKey[] | ((state: any) => boolean),
  { timeout = 1000 }: WaitForStoreOptions = {},
): Promise<unknown> {
  const handle = entryOf(store, "waitForStore").getStore(params)
  const keys = Array.isArray(until) ? until as readonly PropertyKey[] : undefined
  const isReady = keys
    ? (state: Record<PropertyKey, unknown>) => keys.every(key => state[key] !== undefined)
    : until as ((state: unknown) => boolean) | undefined

  return whileWaiting(() => new Promise((resolve, reject) => {
    // holds the context while waiting, so what an instance publishes meanwhile is not dropped with it
    const { ctx, release } = acquireContext<object>(handle.name)
    let settled = false
    const offs: (() => void)[] = []
    const settle = (finish: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      offs.forEach(off => off())
      release()
      finish()
    }
    const check = () => {
      if (ctx.failed) return settle(() => reject(ctx.error))
      const state = handle.get() as Record<PropertyKey, unknown>
      if (isReady ? isReady(state) : ctx.ready) settle(() => resolve(state))
    }
    const timer = setTimeout(() => {
      const error = new Error(timeoutMessage(ctx, timeout, handle.get() as Record<PropertyKey, unknown>, keys))
      settle(() => reject(error))
    }, timeout)
    // ready is set after the first publish, which a hook returning no keys makes without notifying
    offs.push(ctx.subscribeAll(check), ctx.onStatus(check), ctx.onReady(check))
    if (settled) offs.forEach(off => off())   // onReady ran check at once
    else check()
  }))
}
