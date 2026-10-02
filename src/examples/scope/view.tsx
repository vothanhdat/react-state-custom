import { useCounterStore } from './state'

export const Counter = ({ label }: { label: string }) => {
    const { count, increment } = useCounterStore()
    return (
        <button onClick={increment} style={{ padding: '0.5rem 1rem' }}>
            {label}: {count}
        </button>
    )
}

export const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '0.5rem' }}>{children}</div>
    </div>
)

export default Counter
