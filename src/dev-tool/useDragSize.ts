import { useRef, useState } from "react"

/**
 * Size of a pane resized by dragging a handle. `grow` is the pointer direction that enlarges the
 * pane: `'right'` for a left pane dragged at its right edge, `'up'` for a bottom pane dragged at
 * its top edge. The handle captures the pointer, so there are no window listeners and nothing
 * to clean up if the handle unmounts mid-drag.
 */
export const useDragSize = (
    initial: number | (() => number),
    grow: 'right' | 'up',
    { min = 80, onEnd }: { min?: number, onEnd?: (size: number) => void } = {}
) => {
    const [size, setSize] = useState(initial)
    const sizeRef = useRef(size)

    const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return
        e.preventDefault()
        const target = e.currentTarget
        const start = grow === 'right' ? e.clientX : e.clientY
        const startSize = sizeRef.current
        target.setPointerCapture?.(e.pointerId)

        const move = (ev: PointerEvent) => {
            const delta = grow === 'right' ? ev.clientX - start : start - ev.clientY
            sizeRef.current = Math.max(min, Math.round(startSize + delta))
            setSize(sizeRef.current)
        }
        const stop = () => {
            target.removeEventListener('pointermove', move)
            target.removeEventListener('pointerup', stop)
            target.removeEventListener('pointercancel', stop)
            onEnd?.(sizeRef.current)
        }
        target.addEventListener('pointermove', move)
        target.addEventListener('pointerup', stop)
        target.addEventListener('pointercancel', stop)
    }

    return { size, onPointerDown }
}
