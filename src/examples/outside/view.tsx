import { useEffect, useState } from 'react'
import { connectFeed, pricesRef, usePricesStore } from './state'

// An ordinary consumer.
export const PriceTable = () => {
    const { prices, updates } = usePricesStore()
    return (
        <div className="card">
            <h3>Prices <small>{updates ?? 0} updates</small></h3>
            <ul className="list">
                {Object.entries(prices ?? {}).map(([symbol, price]) => (
                    <li key={symbol}><span className="grow">{symbol}</span>${price.toLocaleString()}</li>
                ))}
            </ul>
        </div>
    )
}

// Starts and stops the feed defined in state.ts.
export const FeedControls = () => {
    const [connected, setConnected] = useState(false)
    useEffect(() => (connected ? connectFeed() : undefined), [connected])
    return (
        <div className="row">
            <button onClick={() => setConnected(c => !c)}>{connected ? 'Disconnect feed' : 'Connect feed'}</button>
            <button onClick={() => logSnapshot()}>Log snapshot to console</button>
        </div>
    )
}

// storeRef().get() in a handler: a plain snapshot, no subscription.
const logSnapshot = () => console.log('prices snapshot', pricesRef().get().prices)

// storeRef().subscribe(): every change with its key, outside the proxy.
export const ChangeLog = () => {
    const [lines, setLines] = useState<string[]>([])
    useEffect(
        () => pricesRef().subscribe((state, key) => {
            if (key !== 'prices') return
            setLines(l => [`${new Date().toLocaleTimeString()} ${JSON.stringify(state.prices)}`, ...l].slice(0, 5))
        }),
        []
    )
    return (
        <div className="card">
            <h3>subscribe() log</h3>
            <pre className="log">{lines.join('\n') || 'Connect the feed to see changes.'}</pre>
        </div>
    )
}

export default PriceTable
