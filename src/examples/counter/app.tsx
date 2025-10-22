import { CounterExample } from './view'

export default function App() {
    return (
        <>
            {/* <AutoRootCtx/> */}
            <CounterExample />
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                A simple counter demonstrating basic state management with increment, decrement, and reset operations.
            </p>
            {/* <DevToolContainer Component={DataView} /> */}
        </>
    )
}
