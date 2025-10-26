import { CounterExample } from './view'
import '../examples.css'

export default function App() {
    return (
        <>
            <CounterExample />
            <p className="example-description">
                A simple counter demonstrating basic state management with increment, decrement, and reset operations.
            </p>
        </>
    )
}
