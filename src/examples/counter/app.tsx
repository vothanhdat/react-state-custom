import { CounterExample } from './view'

// Two components, one store: both read and update the same count.
export default function App() {
    return (
        <>
            <CounterExample />
            <CounterExample />
        </>
    )
}
