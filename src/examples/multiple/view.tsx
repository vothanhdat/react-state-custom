import { useCounterStore } from './state'

export const Counter = ({ label }: { label: string }) => {
    const { count, increment } = useCounterStore()
    return <button onClick={increment}>{label}: {count}</button>
}

export const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card">
        <h3>{title}</h3>
        <div className="row">{children}</div>
    </div>
)

export default Counter
