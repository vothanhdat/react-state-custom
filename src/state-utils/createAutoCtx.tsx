import { useEffect, useState, Fragment, useCallback } from "react"
import { useDataContext, useDataSourceMultiple, useDataSubscribe, type Context } from "./ctx"
import { createRootCtx } from "./createRootCtx"






const weakmapName = (function () {
  const weakmap = new WeakMap()

  return (e: any): string => {
    let result = weakmap.get(e);
    if (!result) {
      weakmap.set(e, result = (e?.name ?? "") + ":" + Math.random().toString())
    }
    return result
  }
})()


const resolveName = (e: any) => [
  ...Object
    .entries(e ?? {})
    .sort((e, f) => e[0].localeCompare(f[0]))
    .flat()
].join("-")

/**
 * Inline docs: createAutoCtx + AutoRootCtx
 *
 * Quick start
 * 1) Mount <AutoRootCtx /> ONCE near your app root. Provide a Wrapper that acts like an ErrorBoundary to isolate and log errors.
 *    Example: <AutoRootCtx Wrapper={MyErrorBoundary} />
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

export const AutoRootCtx = ({ Wrapper = Fragment }) => {

  const ctx = useDataContext<any>("auto-ctx")


  // const [state, setState] = useState<Record<string, { Component: React.FC, subState: Record<string, { params: any, counter: number }> }>>({})
  const [state, setState] = useState<Record<string, { Component: React.FC, params: any, paramKey: string, counter: number }>>({})


  const subscribeRoot = useCallback(
    (contextName: string, Component: React.FC<any>, params: any) => {

      const recordKey = [contextName, weakmapName(Component), resolveName(params)].join(":");

      setState(state => ({
        ...state,
        [recordKey]: {
          ...state[recordKey] ?? { Component, params, paramKey: resolveName(params) },
          counter: (state[recordKey]?.counter ?? 0) + 1,
        }
      }))

      return () => setState(({ [recordKey]: current, ...rest }) => ({
        ...rest,
        ...(current?.counter > 1) ? {
          [recordKey]: { ...current, counter: current.counter - 1 }
        } : {}
      }))

    },
    []
  )

  useDataSourceMultiple(ctx,
    ["subscribe", subscribeRoot],
    ["state", state],
  )


  return <>
    {Object
      .entries(state)
      .map(([key, { Component, params, counter, paramKey }]) => <Wrapper key={key}>
        <Component key={paramKey} {...params} />
      </Wrapper>)}
  </>

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
export const createAutoCtx = <U extends object, V extends object,>(
  { Root, resolveCtxName, name }: ReturnType<typeof createRootCtx<U, V>>,
) => {

  return {

    useCtxState: (e: U): Context<V> => {

      const ctxName = resolveCtxName(e)

      const subscribe = useDataSubscribe(useDataContext<any>("auto-ctx"), "subscribe")

      useEffect(
        () => subscribe?.(name, Root, e),
        [Root, subscribe, name, ctxName]
      )

      return useDataContext<V>(ctxName)
    }
  }
}