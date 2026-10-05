import { useTimerStore } from './state'

export const TimerExample = ({ timerId }: { timerId: string }) => {
    const { formattedTime, isRunning, start, pause, reset } = useTimerStore({ timerId })

    return (
        <div className="card">
            <h3>Timer <small>{timerId}</small></h3>
            <div className="clock">{formattedTime ?? '00:00.00'}</div>
            <div className="row">
                {isRunning ? <button onClick={pause}>Pause</button> : <button onClick={start}>Start</button>}
                <button onClick={reset}>Reset</button>
            </div>
        </div>
    )
}

export default TimerExample
