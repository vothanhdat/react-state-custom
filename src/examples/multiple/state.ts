import { createStore } from '../../index'
import { useState } from 'react'

// One store definition, one instance per id: each counter starts when something reads it
// and stops when the last reader leaves.
const useCounterState = ({ id }: { id: string }) => {
    const [count, setCount] = useState(0)
    const increment = () => setCount(c => c + 1)
    return { id, count, increment }
}

export const { useStore: useCounter, storeRef: counterRef } = createStore('counter-by-id', useCounterState)
