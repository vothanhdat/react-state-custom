import { useEffect, useMemo } from "react"
import { useDataContext, useDataSourceMultiple, type Context } from "./ctx"



export const createRootCtx = <U extends object, V extends object>(name: string, useFn: (e: U) => V) => {

  const resolveCtxName = (e: U) => [
    name,
    ...Object
      .entries(e ?? {})
      .sort((e, f) => e[0].localeCompare(f[0]))
      .flat()
  ].join("-")

  let isCtxMounted = false

  return {
    Root: (e: U) => {
      const ctx = useDataContext<V>(resolveCtxName(e))
      const state = useFn(e)
      const stack = useMemo(() => new Error().stack, [])

      useDataSourceMultiple(
        ctx,
        ...Object.entries(state) as any
      )

      useEffect(() => {
        if (isCtxMounted == true) {
          const err = new Error("RootContext " + resolveCtxName(e) + " are mounted more than once")
          err.stack = stack;
          throw err
        }
        isCtxMounted = true;
        return () => { isCtxMounted = false };
      })

      return <></>
    },
    useCtxState: (e: U): Context<V> => {

      const stack = useMemo(() => new Error().stack, [])

      useEffect(() => {
        if (!isCtxMounted) {
          const err = new Error("RootContext [" + resolveCtxName(e) + "] is not mounted")
          err.stack = stack;
          throw err
        }
      }, [isCtxMounted])

      return useDataContext<V>(resolveCtxName(e))
    }
  }
}