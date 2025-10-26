import { TimerExample } from './view'
import '../examples.css'

export default function App() {
    return (
        <>
            <TimerExample timerId="timer1" />
            <TimerExample timerId="timer2" />
            <p className="example-description">
                Multiple independent timers demonstrating side effects (setInterval) within context state.
                Each timer can run independently.
            </p>
        </>
    )
}
