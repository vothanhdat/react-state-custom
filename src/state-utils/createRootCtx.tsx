import { useContext, useEffect, useMemo } from "react"
import { useDataContext, useDataSourceMultiple, StateScopeContext, type Context } from "./ctx"
import { paramsToId, type ParamsToIdRecord } from "./paramsToId"
import { DependencyTracker } from "./utils"
// import { debugObjTime } from "./debugObjTime"


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
    
    DependencyTracker.enter(scopedCtxName);
    let state;
    try {
      state = useFn(e, { ...ctx.data })
    } finally {
      DependencyTracker.leave();
    }

    const stack = useMemo(() => new Error().stack, [])

    useDataSourceMultiple(
      ctx,
      ...Object.entries(state) as any
    )

    useEffect(() => {
      if (ctxMountedCheck.has(scopedCtxName)) {
        const err = new Error("RootContext " + scopedCtxName + " are mounted more than once")
        err.stack = stack;
        throw err
      }
      ctxMountedCheck.add(scopedCtxName)
      return () => { ctxMountedCheck.delete(scopedCtxName) };
    })

    return state;
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
    useCtxStateStrict: (e: U): Context<V> => {
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
    useCtxState: (e: U): Context<V> => {
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
