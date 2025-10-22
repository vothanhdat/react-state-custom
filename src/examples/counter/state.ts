import { createRootCtx, createAutoCtx } from '../../index'
import { useCallback, useState } from 'react'

export const { useCtxState: useCounterCtx } = createAutoCtx(
    createRootCtx(
        "counter",
        () => {
            const [count, setCount] = useState(0)
            
            const increment = useCallback(() => setCount(c => c + 1), [])
            const decrement = useCallback(() => setCount(c => c - 1), [])
            const reset = useCallback(() => setCount(0), [])
            
            return {
                count,
                increment,
                decrement,
                reset,
            }
        }
    )
)
