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

  let ctxMountedCheck = new Set<string>()

  return {
    Root: (e: U) => {
      const ctxName = resolveCtxName(e)
      const ctx = useDataContext<V>(ctxName)
      const state = useFn(e)
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

      return <></>
    },
    useCtxStateStrict: (e: U): Context<V> => {
      const ctxName = resolveCtxName(e)

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
    useCtxState: (e: U): Context<V> => {
      const ctxName = resolveCtxName(e)

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