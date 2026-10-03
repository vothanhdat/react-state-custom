import { useEffect, useState } from "react"
import { getContext } from "../state-utils/ctx"

/**
 * A counter that increments whenever a context is created or evicted, so a component can
 * re-read `getContext.cache` in render. The cache notifies synchronously, often from inside a
 * consumer's render (`useDataContext` creates the context there), where setState on another
 * component is not allowed: changes are coalesced and applied in a microtask, after React has
 * finished the current render pass.
 */
export const useCacheVersion = () => {
    const [version, setVersion] = useState(0)
    useEffect(() => {
        let alive = true
        let pending = false
        const unsubscribe = getContext.cache.subscribe(() => {
            if (pending) return
            pending = true
            queueMicrotask(() => {
                pending = false
                if (alive) setVersion(v => v + 1)
            })
        })
        return () => {
            alive = false
            unsubscribe()
        }
    }, [])
    return version
}
