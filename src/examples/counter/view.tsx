import { useQuickSubscribe } from '../../index'
import { useCounterCtx } from './state'

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

export default CounterExample
