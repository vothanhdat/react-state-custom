import { useEffect, useState, Fragment, useCallback } from "react"
import { useDataContext, useDataSourceMultiple, useDataSubscribe, type Context } from "./ctx"
import { createRootCtx } from "./createRootCtx"






const weakmapName = (function () {
  const weakmap = new WeakMap()

  return (e: any): string => {
    let result = weakmap.get(e);
    if (!result) {
      weakmap.set(e, result = (e?.name ?? "") + Math.random().toString())
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


  const [state, setState] = useState<Record<string, { Component: React.FC, subState: Record<string, { params: any, counter: number }> }>>({})


  const subscribeRoot = useCallback(
    (Comp: any, params: any) => {
      const weakName = weakmapName(Comp);
      const key = resolveName(params);

      setState(({
        [weakName]: {
          Component = Comp,
          subState: {
            [key]: preState = { params, counter: 0 },
            ...subState
          } = {}
        } = {},
        ...state
      }) => ({
        ...state,
        [weakName]: {
          Component,
          subState: {
            ...subState,
            [key]: {
              ...preState,
              counter: preState.counter + 1,
            },
          },
        }
      }));

      return () => setState(({
        [weakName]: {
          Component = Comp,
          subState: {
            [key]: preState = { params, counter: 0 },
            ...subState
          } = {}
        } = {},
        ...state
      }) => ({
        ...state,
        [weakName]: {
          Component,
          subState: {
            ...subState,
            ...preState.counter > 1 ? {
              [key]: {
                ...preState,
                counter: preState.counter - 1,
              },
            } : {},
          },
        }
      }))

    },
    []
  )

  useDataSourceMultiple(ctx,
    ["subscribe", subscribeRoot],
    ["state", state],
  )


  return <>
    {Object.entries(state)
      .flatMap(([k1, { Component, subState }]) => Object
        .entries(subState)
        .map(([k2, { counter, params }]) => ({ key: k1 + k2, Component, params, counter }))
        .filter(e => e.counter > 0)
        .map(({ key, params, Component }) => <Wrapper key={key} >
          <Component {...params} />
        </Wrapper>)
      )
    }
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
  { Root, useCtxState, useCtxStateStrict, resolveCtxName }: ReturnType<typeof createRootCtx<U, V>>,
  unmountTime = 0
) => {

  return {

    useCtxState: (e: U): Context<V> => {

      const ctxName = resolveCtxName(e)

      const subscribe = useDataSubscribe(useDataContext<any>("auto-ctx"), "subscribe")

      useEffect(() => {
        // Subscribe this component to an AutoRootCtx-managed Root instance keyed by e.
        // AutoRootCtx handles instance ref-counting and cleanup on unmount.
        if (unmountTime == 0) {
          return subscribe?.(Root, e)
        } else {
          let unsub = subscribe?.(Root, e)
          return () => setTimeout(unsub, unmountTime)
        }
      }, [subscribe, ctxName])

      return useDataContext<V>(ctxName)
    }
  }
}