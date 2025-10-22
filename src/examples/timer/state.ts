import { createRootCtx, createAutoCtx } from '../../index'
import { useCallback, useEffect, useState } from 'react'

export const { useCtxState: useTimerCtx } = createAutoCtx(
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
