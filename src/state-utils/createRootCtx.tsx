import { useContext, useEffect, useMemo, useRef, useState } from "react"
import { useDataContext, StateScopeContext, type Context, useIsomorphicLayoutEffect, functionSources, selectorScope, type FunctionSource } from "./ctx"
import { paramsToId, type ParamsToIdRecord } from "./paramsToId"
import { DependencyTracker } from "./utils"

type StableFn = FunctionSource & { stable: Function }

/** Arrow functions and methods have no prototype, so the source text is read only for `function`s and classes. */
const isClass = (fn: Function) => fn.prototype !== undefined && /^class[\s{]/.test(Function.prototype.toString.call(fn))

/**
 * Publishes the store's result after each commit, in one pass over its keys.
 *
 * Function-valued keys get a stable identity. Store hooks usually return fresh closures
 * (`const increment = () => ...`) on every render; publishing those directly would notify every
 * consumer that destructures an action on every store render. Instead each function key gets one
 * wrapper that forwards to the latest committed implementation. Classes are left as-is.
 *
 * A function a consumer calls while rendering (a getter such as `getItem(id)`, a component) is a
 * value, not an action: when its implementation changes the key is announced with `Context.touch`,
 * so those consumers re-render. Calls from event handlers never mark a function.
 *
 * Every other value is compared with what the context holds (`Object.is`); changed and removed keys
 * go out in one `publishMany`. O(keys) per commit without intermediate copies or arrays, which
 * matters for collections keyed by id.
 */
const usePublish = (ctx: Context<any>, state: Record<string, unknown>) => {
  const wrappers = useRef(new Map<string, StableFn>()).current
  const last = useRef<{ ctx: Context<any>, state: Record<string, unknown> } | null>(null)

  useIsomorphicLayoutEffect(() => {
    const previous = last.current?.ctx === ctx ? last.current.state : undefined
    last.current = { ctx, state }
    if (previous === state) return
    const data = ctx.data
    let changed: [string, unknown][] | undefined
    let touched: string[] | undefined

    for (const key in state) {
      let value = state[key]
      if (typeof value === "function" && !isClass(value)) {
        const entry = wrappers.get(key)
        if (!entry) {
          value = createStableFn(key, value, wrappers)
        } else {
          if (entry.latest !== value) {
            entry.latest = value
            if (entry.calledInRender) (touched ??= []).push(key)
          }
          value = entry.stable
        }
      } else if (wrappers.size > 0) {
        wrappers.delete(key)
      }
      if (!Object.is(data[key], value)) (changed ??= []).push([key, value])
    }

    let removed: string[] | undefined
    if (previous) {
      for (const key in previous) {
        if (Object.hasOwn(state, key)) continue
        wrappers.delete(key);
        (removed ??= []).push(key)
      }
    }

    if (changed || removed) ctx.publishMany(changed ?? [], removed)
    if (touched) ctx.touch(touched)
  })
}

const createStableFn = (key: string, value: Function, wrappers: Map<string, StableFn>) => {
  const created: StableFn = {
    latest: value,
    calledInRender: false,
    stable: function (this: unknown, ...args: unknown[]) {
      if (selectorScope.depth > 0) created.calledInRender = true
      return created.latest.apply(this, args)
    },
  }
  try {
    Object.defineProperty(created.stable, "name", { value: value.name || key })
  } catch { /* non-configurable in exotic environments; ignore */ }
  functionSources.set(created.stable, created)
  wrappers.set(key, created)
  return created.stable
}


/**
 * createRootCtx
 *
 * Factory that creates a headless "Root" component and companion hooks for a context namespace.
 * It derives a unique context name from a base `name` and a props object `U`, then publishes
 * a computed state `V` (from `useFn`) to that context. `useFn` receives `(props, preState)` where
 * `preState` is the previously published data for this context (if any), letting you warm start
 * when a Root remounts (e.g., during AutoRootCtx cleanup/revival).
 *
 * Usage (manual mounting):
 * ```
 * const { Root, useCtxState } = createRootCtx('user-state', (props, preState) =>
 *   useUserState(props, preState)
 * )
 *  ...
 * // Mount exactly one Root per unique props combination
 * <Root userId={id} />
 *  ...
 * // Read anywhere ,using the same props shape
 * const user = useCtxState({ userId: id })
 *```
 * Strict vs lenient consumers:
 * - useCtxStateStrict(props) throws if a matching Root is not mounted.
 * - useCtxState(props) logs an error (after 1s) instead of throwing.
 *
 * Multiple instances safety:
 * - Mounting more than one Root with the same resolved context name throws (guards accidental duplicates).
 *
 * Name resolution notes:
 * - The context name is built from `name` + sorted key/value pairs of `props` (U), joined by "-".
 * - Prefer stable, primitive props to avoid collisions; if you need automation, pair with `createAutoCtx` and
 *   mount a single <AutoRootCtx Wrapper={ErrorBoundary} /> at the app root so you don't manually mount `Root`.
 */
export const createRootCtx = <U extends ParamsToIdRecord, V extends Record<string, unknown>>(name: string, useFn: (e: U, preState: Partial<V>) => V) => {

  const getCtxName = (e: U) => [name, paramsToId(e)]
    .filter(Boolean)
    .join("?");

  const ctxMountedCheck = new Set<string>()

  const useRootState = (e: U) => {
    const ctxName = getCtxName(e)
    const scopeId = useContext(StateScopeContext)
    const scopedCtxName = scopeId ? `${scopeId}/${ctxName}` : ctxName
    const ctx = useDataContext<V>(ctxName)
    // what an earlier instance with this identity published (warm start); read once, on mount
    const [preState] = useState(() => ({ ...ctx.data }) as Partial<V>)

    DependencyTracker.enter(scopedCtxName);
    let rawState: V;
    try {
      rawState = useFn(e, preState)
    } finally {
      DependencyTracker.leave();
    }
    const stack = useMemo(() => new Error().stack, [])

    usePublish(ctx, rawState)

    // Declared after usePublish so it runs after the first publish: the context is
    // "ready" once consumers can see real values instead of initialState (see useStoreSuspense).
    useIsomorphicLayoutEffect(() => { ctx.markReady() }, [ctx])

    useEffect(() => {
      if (ctxMountedCheck.has(scopedCtxName)) {
        const err = new Error("RootContext " + scopedCtxName + " are mounted more than once")
        err.stack = stack;
        throw err
      }
      ctxMountedCheck.add(scopedCtxName)
      return () => { ctxMountedCheck.delete(scopedCtxName) };
    }, [scopedCtxName])

    return rawState;
  }

  const Debug = ({ }) => <></>

  const RootState: React.FC<U> = (e: U) => {
    const state = useRootState(e);
    return <Debug {...e} {...state} />
  }

  useRootState.displayName = `useState[${name}]`
  RootState.displayName = `StateContainer[${name}]`
  Debug.displayName = `Debug[${name}]`

  return {
    name,
    getCtxName,
    useRootState,
    Root: RootState,
    /**
     * Strict consumer: throws if the corresponding Root for these props isn't mounted.
     * Use in development/tests to fail fast when wiring is incorrect.
     */
    useCtxStateStrict: (e: U = {} as U): Context<V> => {
      const ctxName = getCtxName(e)
      const scopeId = useContext(StateScopeContext)
      const scopedCtxName = scopeId ? `${scopeId}/${ctxName}` : ctxName

      const stack = useMemo(() => new Error().stack, [])

      useEffect(() => {
        if (!ctxMountedCheck.has(scopedCtxName)) {
          const err = new Error("RootContext [" + scopedCtxName + "] is not mounted")
          err.stack = stack;
          throw err
        }
      }, [scopedCtxName])

      return useDataContext<V>(ctxName)
    },
    /**
     * Lenient consumer: schedules a console.error if the Root isn't mounted instead of throwing.
     * Useful in production to avoid hard crashes while still surfacing misconfiguration.
     */
    useCtxState: (e: U = {} as U): Context<V> => {
      const ctxName = getCtxName(e)
      const scopeId = useContext(StateScopeContext)
      const scopedCtxName = scopeId ? `${scopeId}/${ctxName}` : ctxName

      const stack = useMemo(() => new Error().stack, [])

      useEffect(() => {
        if (!ctxMountedCheck.has(scopedCtxName)) {
          const err = new Error("RootContext [" + scopedCtxName + "] is not mounted")
          err.stack = stack;
          let timeout = setTimeout(() => console.error(err), 1000)
          return () => clearTimeout(timeout)
        }
      }, [ctxMountedCheck.has(scopedCtxName)])

      return useDataContext<V>(ctxName)
    }
  }
}
