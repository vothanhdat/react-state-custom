import { createContext, useEffect, useMemo, useState, Fragment, useCallback } from "react"
import { getContext, useDataContext, useDataSource, useDataSourceMultiple, useDataSubscribe, type Context } from "./ctx"
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

export const createAutoCtx = <U extends object, V extends object,>({ Root, useCtxState, useCtxStateStrict, resolveCtxName }: ReturnType<typeof createRootCtx<U, V>>) => {

  return {

    useCtxState: (e: U): Context<V> => {

      const ctxName = resolveCtxName(e)

      const subscribe = useDataSubscribe(useDataContext<any>("auto-ctx"), "subscribe")

      useEffect(() => {
        return subscribe?.(Root, e)
      }, [subscribe, ctxName])

      return useDataContext<V>(ctxName)
    }
  }
}