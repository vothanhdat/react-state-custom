import { useEffect, useState, Fragment, useCallback, useMemo, useId } from "react"
import { useDataContext, useDataSourceMultiple, useDataSubscribe, StateScopeContext, type Context } from "./ctx"
import { createRootCtx } from "./createRootCtx"
import { paramsToId, type ParamsToIdRecord } from "./paramsToId"
import { useQuickSubscribe } from "./useQuickSubscribe"



const DebugState = ({ }) => <></>

const StateRunner: React.FC<{ useStateFn: Function, params: ParamsToIdRecord, debugging: boolean }> = ({ useStateFn, params, debugging }) => {
  const state = useStateFn(params)
  return debugging ? <DebugState {...state} /> : <></>
}


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

export const AutoRootCtx: React.FC<{ Wrapper?: React.FC<any>, debugging?: boolean }> = ({ Wrapper = Fragment, debugging = false }) => {

  const ctx = useDataContext<any>("auto-ctx")

  const [state, setState] = useState<Record<string, {
    useStateFn: Function,
    AttatchedComponent: React.FC<any> | undefined
    params: ParamsToIdRecord,
    // paramKey: string,
    counter: number,
    keepUntil?: number
  }>>({})


  const subscribeRoot = useCallback(
    (contextName: string, useStateFn: Function, params: ParamsToIdRecord, timeToCleanState = 0, AttatchedComponent = undefined) => {

      const recordKey = [contextName, paramsToId(params)].filter(Boolean).join("?")


      setState(state => ({
        ...state,
        [recordKey]: {
          ...state[recordKey] ?? { useStateFn, params, AttatchedComponent },
          counter: (state[recordKey]?.counter ?? 0) + 1,
          keepUntil: undefined,
          useStateFn,
          AttatchedComponent,
        }
      }))

      return () => setState(({ [recordKey]: current, ...rest }) => ({
        ...rest,
        ...(current?.counter > 1 || timeToCleanState > 0) ? {
          [recordKey]: {
            ...current,
            counter: current.counter - 1,
            keepUntil: current.counter > 1 ? undefined : (Date.now() + timeToCleanState),
          }
        } : {}
      }))

    },
    []
  )

  const nextDelete = useMemo(() => Object.entries(state)
    .filter(([, { counter, keepUntil }]) => counter <= 0 && keepUntil)
    .toSorted(([, { keepUntil: k1 = 0 }], [, { keepUntil: k2 = 0 }]) => k1 - k2)
    ?.at(0),
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
      .map(([key, { useStateFn, params, AttatchedComponent }]) => <Wrapper key={key}>
        <StateRunner key={key} params={params} useStateFn={useStateFn} debugging={debugging} />
        {AttatchedComponent && <AttatchedComponent key={'attatch_' + key} {...params} />}
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
export const createAutoCtx = <U extends ParamsToIdRecord, V extends Record<string, unknown>>(
  { useRootState, getCtxName, name }: ReturnType<typeof createRootCtx<U, V>>,
  timeToClean = 0,
  AttatchedComponent: React.FC<U> | undefined = undefined
) => {

  const useCtxState = (e: U): Context<V> => {

    const ctxName = getCtxName(e)

    const subscribe = useDataSubscribe(useDataContext<any>("auto-ctx"), "subscribe")

    useEffect(
      () => subscribe?.(name, useRootState, e, timeToClean, AttatchedComponent),
      [useRootState, subscribe, name, ctxName, timeToClean, AttatchedComponent]
    )

    return useDataContext<V>(ctxName)
  }

  return {
    useCtxState,
    useStore: (e: U) => useQuickSubscribe(useCtxState(e))
  }
}

export const createStore = <U extends ParamsToIdRecord, V extends Record<string, unknown>>(
  name: string,
  useFn: (params: U, preState: Partial<V>) => V,
  timeToClean = 0,
  AttatchedComponent: React.FC<U> | undefined = undefined
) => {
  return createAutoCtx(createRootCtx(name, useFn), timeToClean, AttatchedComponent)
}

export const StateScopeProvider: React.FC<{
  children: React.ReactNode
  Wrapper?: React.FC<any>
  debugging?: boolean
}> = ({ children, Wrapper, debugging }) => {
  const scopeId = useId()
  return <StateScopeContext.Provider value={scopeId}>
    <AutoRootCtx Wrapper={Wrapper} debugging={debugging} />
    {children}
  </StateScopeContext.Provider>
}
