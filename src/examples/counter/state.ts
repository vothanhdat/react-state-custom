import { createStore } from '../../index'
import { useState } from 'react'


const useCounterState = ({ }) => {
    const [count, setCount] = useState(0)
    const increment = () => setCount(c => c + 1)
    const decrement = () => setCount(c => c - 1)
    const reset = () => setCount(0)
    return {
        count,
        setCount,
        increment,
        decrement,
        reset,
    }
}


export const { useStore: useCounterStore } = createStore(
    "counter",
    useCounterState,
    5000
)
