import { TimerExample } from './view'

// setInterval lives in the store hook's effect; it is cleaned up when the instance is torn down.
export default function App() {
    return (
        <>
            <TimerExample timerId="A" />
            <TimerExample timerId="B" />
        </>
    )
}
