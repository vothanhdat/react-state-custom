import { useMultipleStore } from '../../index'
import { counterRef, useCounter } from './state'

// One instance, read with useStore.
export const Counter = ({ id }: { id: string }) => {
    const { count, increment } = useCounter({ id })
    return <button onClick={increment}>{id}: {count ?? 0}</button>
}

// Every instance of a list in one call, however long the list: one proxy per instance,
// and the component re-renders for the keys it read.
export const Board = ({ ids }: { ids: string[] }) => {
    const counters = useMultipleStore(ids.map(id => counterRef({ id })))
    return <p>{counters.map(counter => `${counter.id ?? '…'} = ${counter.count ?? 0}`).join(' · ') || 'No counters.'}</p>
}

// A value over every instance: renders only when the total changes.
export const Total = ({ ids }: { ids: string[] }) => {
    const total = useMultipleStore(ids.map(id => counterRef({ id })), {
        select: counters => counters.reduce((sum, counter) => sum + (counter.count ?? 0), 0),
    })
    return <strong>Total: {total}</strong>
}

export const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card">
        <h3>{title}</h3>
        <div className="row">{children}</div>
    </div>
)

export default Counter
