import { useMemo } from "react"


export const useRefValue = <T extends object>(e: T) => {
  const ref = useMemo(() => ({ ...e }), [])
  Object.assign(ref, e)
  return ref
}