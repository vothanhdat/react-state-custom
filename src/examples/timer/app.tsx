import { TimerExample } from './view'

export default function App() {
    return (
        <>
            {/* <AutoRootCtx/> */}
            <TimerExample timerId="timer1" />
            <TimerExample timerId="timer2" />
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Multiple independent timers demonstrating side effects (setInterval) within context state.
                Each timer can run independently.
            </p>
            {/* <DevToolContainer Component={DataView} /> */}
        </>
    )
}
