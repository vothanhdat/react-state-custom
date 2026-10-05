import { useCounterStore } from './state'

export const CounterExample = () => {
    const { count, increment, decrement, reset } = useCounterStore()

    return (
        <div className="card">
            <h3>Counter</h3>
            <div className="row">
                <button onClick={decrement}>-</button>
                {/* undefined until the store has run once */}
                <strong>{count ?? 0}</strong>
                <button onClick={increment}>+</button>
                <button onClick={reset}>Reset</button>
            </div>
        </div>
    )
}

export default CounterExample
