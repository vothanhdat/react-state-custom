import { createAutoCtx } from '../state-utils/createAutoCtx'
import { createRootCtx } from '../state-utils/createRootCtx'
import { useCallback, useState } from 'react'
import { useQuickSubscribe } from '../state-utils/useQuickSubscribe'

const { useCtxState: useCounterCtx } = createAutoCtx(
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

export const CounterExample = () => {
    const { count, increment, decrement, reset } = useQuickSubscribe(useCounterCtx({}))

    return (
        <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
            <h3>Basic Counter</h3>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button onClick={decrement}>-</button>
                <span style={{ minWidth: '3rem', textAlign: 'center' }}>{count}</span>
                <button onClick={increment}>+</button>
                <button onClick={reset}>Reset</button>
            </div>
        </div>
    )
}
