import "./DevTool.css"
import React, { useState } from "react"
import { DevToolState } from "./DevToolState"
import { DataViewDefault, type DataViewComponent } from "./DataViewComponent"
import { useDragSize } from "./useDragSize"
import { readSetting, writeSetting } from "./settings"
import { useIsomorphicLayoutEffect } from "../state-utils/ctx"

/** Panel height before the viewport is known (on the server, and in the render that hydrates it). */
const SERVER_HEIGHT = 300

export type DevToolContainerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'type'> & {
    /** Renders one store's value. Defaults to `DataViewDefault`, a JSON text view. */
    Component?: DataViewComponent
    /** Open the panel on first mount. Default `false`. Afterwards the open state is remembered per tab. */
    defaultOpen?: boolean
    /** Panel height in pixels on first open. Default: a third of the viewport. */
    defaultHeight?: number
}

/**
 * Floating store inspector: a fixed trigger button and, while open, a resizable panel docked to
 * the bottom of the viewport. Every prop other than the ones above is forwarded to the button,
 * which is hidden while the panel is open (the panel has its own close button).
 */
export const DevToolContainer = ({ Component = DataViewDefault, defaultOpen = false, defaultHeight, children, ...buttonProps }: DevToolContainerProps) => {
    const [open, setOpen] = useState(defaultOpen)
    // The remembered state is read once mounted, so the first render matches what a server renders
    useIsomorphicLayoutEffect(() => { setOpen(readSetting('open', defaultOpen)) }, [])
    const toggle = (next: boolean) => {
        setOpen(next)
        writeSetting('open', next)
    }
    return <>
        <button
            type="button"
            className="react-state-dev-btn"
            data-active={open}
            aria-expanded={open}
            onClick={() => toggle(!open)}
            {...buttonProps}
        >
            {children ?? "Toggle Dev Tool"}
        </button>
        {open && <DevToolPanel Component={Component} defaultHeight={defaultHeight} onClose={() => toggle(false)} />}
    </>
}

const DevToolPanel = ({ Component, defaultHeight, onClose }: { Component: DataViewComponent, defaultHeight?: number, onClose: () => void }) => {
    const { size: height, onPointerDown } = useDragSize(
        () => readSetting('height', defaultHeight ?? Math.round(window.innerHeight / 3)),
        defaultHeight ?? SERVER_HEIGHT,
        'up',
        { min: 120, onEnd: h => writeSetting('height', h) }
    )
    return <section className="react-state-dev-panel" style={{ height }} aria-label="react-state-custom stores">
        {/* title bar: drag it to resize the panel */}
        <div className="react-state-dev-bar" onPointerDown={onPointerDown}>
            <span className="react-state-dev-title">react-state-custom</span>
            <button type="button" className="react-state-dev-close" onClick={onClose} onPointerDown={e => e.stopPropagation()} aria-label="Close dev tool">×</button>
        </div>
        <DevToolState Component={Component} />
    </section>
}
