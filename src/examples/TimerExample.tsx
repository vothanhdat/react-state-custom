import { createRootCtx, createAutoCtx, useQuickSubscribe } from '../index'
import { useCallback, useEffect, useState } from 'react'

const { useCtxState: useTimerCtx } = createAutoCtx(
    createRootCtx(
        "timer",
        ({ timerId }: { timerId: string }) => {
            const [milliseconds, setMilliseconds] = useState(0)
            const [isRunning, setIsRunning] = useState(false)

            useEffect(() => {
                if (!isRunning) return
                const interval = setInterval(() => {
                    setMilliseconds(ms => ms + 10)
                }, 10)
                return () => clearInterval(interval)
            }, [isRunning])

            const totalSeconds = Math.floor(milliseconds / 1000)
            const minutes = Math.floor(totalSeconds / 60)
            const seconds = totalSeconds % 60
            const ms = Math.floor((milliseconds % 1000) / 10)
            const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
            
            const start = useCallback(() => setIsRunning(true), [])
            const pause = useCallback(() => setIsRunning(false), [])
            const reset = useCallback(() => {
                setIsRunning(false)
                setMilliseconds(0)
            }, [])

            return {
                timerId,
                milliseconds,
                isRunning,
                formattedTime,
                start,
                pause,
                reset,
            }
        }
    )
)

export const TimerExample = ({ timerId = "main-timer" }: { timerId?: string }) => {
    const { formattedTime, isRunning, start, pause, reset } = 
        useQuickSubscribe(useTimerCtx({ timerId }))

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

export default TimerExample;