import { useTimerStore } from './state'

export const TimerExample = ({ timerId = "main-timer" }: { timerId?: string }) => {
    const { formattedTime, isRunning, start, pause, reset } = 
        useTimerStore({ timerId })

    return (
        <div style={{ padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }}>
            <h3>Timer ({timerId})</h3>
            <div style={{ fontSize: '2rem', fontFamily: 'monospace', marginBottom: '1rem' }}>
                {formattedTime}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!isRunning ? (
                    <button onClick={start}>Start</button>
                ) : (
                    <button onClick={pause}>Pause</button>
                )}
                <button onClick={reset}>Reset</button>
            </div>
        </div>
    )
}

export default TimerExample
