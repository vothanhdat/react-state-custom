import { createStore } from '../../index'
import { useState } from 'react'

const useCounterState = () => {
    const [count, setCount] = useState(0)
    const increment = () => setCount(c => c + 1)
    return { count, increment }
}

export const { useStore: useCounterStore } = createStore('scoped-counter', useCounterState, {
    initialState: { count: 0 },
})
