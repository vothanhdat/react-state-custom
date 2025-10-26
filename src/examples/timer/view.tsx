import { useQuickSubscribe } from '../../index'
import { useTimerCtx } from './state'
import '../examples.css'

export const TimerExample = ({ timerId = "main-timer" }: { timerId?: string }) => {
    const { formattedTime, isRunning, start, pause, reset } = 
        useQuickSubscribe(useTimerCtx({ timerId }))

    return (
        <article className="example-container">
            <h3>Timer ({timerId})</h3>
            <div className="timer-display">
                {formattedTime}
            </div>
            <div className="timer-controls">
                {!isRunning ? (
                    <button onClick={start}>Start</button>
                ) : (
                    <button onClick={pause}>Pause</button>
                )}
                <button onClick={reset}>Reset</button>
            </div>
        </article>
    )
}

export default TimerExample
