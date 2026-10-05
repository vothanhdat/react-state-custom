import { createStore } from '../../index'
import { useState } from 'react'

const START = { BTC: 60000, ETH: 3000, SOL: 150 }
const SYMBOLS = Object.keys(START)

const usePricesState = () => {
    const [prices, setPrices] = useState<Record<string, number>>(START)
    const [updates, setUpdates] = useState(0)

    const setPrice = (symbol: string, price: number) => {
        setPrices(p => ({ ...p, [symbol]: price }))
        setUpdates(n => n + 1)
    }

    return { prices, updates, setPrice }
}

export const { useStore: usePricesStore, getStore: getPricesStore } = createStore('prices', usePricesState, {
    initialState: { prices: START, updates: 0 },
})

// Plain module code, no React. retain() keeps the store running even when no component
// reads it, and the interval pushes updates through the imperative handle.
export const connectFeed = () => {
    const store = getPricesStore()
    const release = store.retain()
    const timer = setInterval(() => {
        const symbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]!
        const { prices, setPrice } = store.get()
        const price = prices[symbol]
        if (price !== undefined) setPrice?.(symbol, Math.round(price * (1 + (Math.random() - 0.5) * 0.02)))
    }, 500)
    return () => {
        clearInterval(timer)
        release()
    }
}
