import { useEffect, useMemo } from "react"
import { useDataContext, useDataSourceMultiple, type Context } from "./ctx"
import { paramsToId } from "./paramsToId"
// import { debugObjTime } from "./debugObjTime"


/**
 * createRootCtx
 *
 * Factory that creates a headless "Root" component and companion hooks for a context namespace.
 * It derives a unique context name from a base `name` and a props object `U`, then publishes
 * a computed state `V` (from `useFn`) to that context.
 *
 * Usage (manual mounting):
 * ```
 * const { Root, useCtxState } = createRootCtx('user-state', useUserState)
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
export const createRootCtx = <U extends object, V extends object>(name: string, useFn: (e: U) => V) => {

  const getCtxName = (e: U) => [name, paramsToId(e)]
    .filter(Boolean)
    .join("?");

  const ctxMountedCheck = new Set<string>()

  const useRootState = (e: U) => {
    const state = useFn(e)
    const ctxName = getCtxName(e)
    const ctx = useDataContext<V>(ctxName)
    const stack = useMemo(() => new Error().stack, [])

    useDataSourceMultiple(
      ctx,
      ...Object.entries(state) as any
    )

    useEffect(() => {
      if (ctxMountedCheck.has(ctxName)) {
        const err = new Error("RootContext " + ctxName + " are mounted more than once")
        err.stack = stack;
        throw err
      }
      ctxMountedCheck.add(ctxName)
      return () => { ctxMountedCheck.delete(ctxName) };
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

      const stack = useMemo(() => new Error().stack, [])

      useEffect(() => {
        if (!ctxMountedCheck.has(ctxName)) {
          const err = new Error("RootContext [" + ctxName + "] is not mounted")
          err.stack = stack;
          throw err
        }
      }, [ctxName])

      return useDataContext<V>(ctxName)
    },
    /**
     * Lenient consumer: schedules a console.error if the Root isn't mounted instead of throwing.
     * Useful in production to avoid hard crashes while still surfacing misconfiguration.
     */
    useCtxState: (e: U): Context<V> => {
      const ctxName = getCtxName(e)

      const stack = useMemo(() => new Error().stack, [])

      useEffect(() => {
        if (!ctxMountedCheck.has(ctxName)) {
          const err = new Error("RootContext [" + ctxName + "] is not mounted")
          err.stack = stack;
          let timeout = setTimeout(() => console.error(err), 1000)
          return () => clearTimeout(timeout)
        }
      }, [ctxMountedCheck.has(ctxName)])

      return useDataContext<V>(ctxName)
    }
  }
}