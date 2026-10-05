import * as React from "react"
import { useRef, useEffect, useState } from "react"
import { getContext } from "../state-utils/ctx"
import { debounce } from "../state-utils/utils"
import { HighlightString } from "./useHighlight"

/** One store instance in the list: its params, how many keys it holds, and a flash on every change. */
export const StateLabelRender: React.FC<{
    name: string
    label: string
    selected: boolean
    onToggle: () => void
}> = ({ name, label, selected, onToggle }) => {
    // the parent re-renders on every cache change, so this is the live instance
    const ctx = getContext.fromCache(name)
    const ref = useRef<HTMLButtonElement>(null)
    const [keyCount, setKeyCount] = useState(() => Object.keys(ctx?.data ?? {}).length)

    useEffect(() => {
        if (!ctx) return
        setKeyCount(Object.keys(ctx.data).length)
        const onChange = debounce(() => {
            setKeyCount(Object.keys(ctx.data).length)
            const el = ref.current
            if (!el) return
            el.classList.add("state-key-updated")
            requestAnimationFrame(() => el.classList.remove("state-key-updated"))
        }, 5)
        const unsubscribe = ctx.subscribeAll(onChange)
        return () => {
            onChange.cancel()
            unsubscribe()
        }
    }, [ctx])

    return <button
        type="button"
        ref={ref}
        className="state-key"
        title={name}
        data-active={selected}
        aria-pressed={selected}
        onClick={onToggle}
    >
        <span className="state-key-name"><HighlightString text={label} /></span>
        <span className="state-key-meta">{keyCount} {keyCount === 1 ? "key" : "keys"}</span>
    </button>
}
