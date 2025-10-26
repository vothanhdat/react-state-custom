import { useQuickSubscribe } from '../../index'
import { useCounterCtx } from './state'
import '../examples.css'

export const CounterExample = () => {
    const { count, increment, decrement, reset } = useQuickSubscribe(useCounterCtx({}))

    return (
        <article className="example-container">
            <h3>Basic Counter</h3>
            <div className="counter-controls">
                <button onClick={decrement}>-</button>
                <span className="counter-display">{count}</span>
                <button onClick={increment}>+</button>
                <button onClick={reset}>Reset</button>
            </div>
        </article>
    )
}

export default CounterExample
