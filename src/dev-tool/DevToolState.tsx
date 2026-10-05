import * as React from "react"
import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { getContext } from "../state-utils/ctx"
import { debounce } from "../state-utils/utils"
import { HighlightString, HightlightWrapper } from "./useHighlight"
import { DataViewComponent, DataViewDefault } from "./DataViewComponent"
import { StateLabelRender } from "./StateLabelRender"
import { useCacheVersion } from "./useCacheVersion"
import { useDragSize } from "./useDragSize"
import { readSetting, writeSetting } from "./settings"
import "./DevTool.css"

/** Up to this many stores can be compared side by side. */
const MAX_SELECTED = 5

/** Store name without params: `"scope/counter?initial=1"` → `"scope/counter"`. */
const groupOf = (name: string) => name.split("?")[0] ?? name

/** `"a/b/counter"` → `["a/b", "counter"]`: scoped stores are named `<scopeId>/<name>`. */
const splitScope = (group: string) => {
    const at = group.lastIndexOf('/')
    return at === -1 ? [undefined, group] as const : [group.slice(0, at), group.slice(at + 1)] as const
}

/** `"counter?initial=1&user=a%20b"` → `"initial=1, user=a b"`, or `"(no params)"`. */
export const paramsLabel = (name: string) => {
    const query = name.slice(name.indexOf("?") + 1)
    if (!name.includes("?") || !query) return "(no params)"
    return query.split("&").map(pair => {
        const [key = "", value = ""] = pair.split("=")
        return `${decodeURIComponent(key)}=${decodeURIComponent(value)}`
    }).join(", ")
}

/**
 * The inspector without the trigger button: a filterable list of the live store instances,
 * grouped by store, and a view of each selected one. Embed it in your own debug UI, or use
 * `DevToolContainer` for the floating version.
 */
export const DevToolState: React.FC<{ Component?: DataViewComponent }> = ({ Component = DataViewDefault }) => {
    const version = useCacheVersion()
    // every live context except the internal root of each scope (named "auto-ctx" or "<scopeId>/auto-ctx")
    const names = useMemo(
        () => [...getContext.cache.values()].map(ctx => ctx.name).filter(name => !/(^|\/)auto-ctx$/.test(name)),
        [version]
    )
    const [filterString, setFilterString] = useState("")
    const [selectedKeys, setSelectedKeys] = useState<string[]>([])
    const { size: listWidth, onPointerDown } = useDragSize(
        () => readSetting('list-width', 220),
        220,
        'right',
        { min: 100, onEnd: w => writeSetting('list-width', w) }
    )

    const groups = useMemo(() => {
        const tokens = filterString.toLowerCase().split(" ").filter(Boolean)
        const matches = (name: string) => tokens.every(token => name.toLowerCase().includes(token))
        const groups: Record<string, string[]> = {}
        for (const name of names) {
            if (matches(name)) (groups[groupOf(name)] ??= []).push(name)
        }
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    }, [names, filterString])

    const toggleSelected = (name: string) => setSelectedKeys(keys => keys.includes(name)
        ? keys.filter(key => key !== name)
        : [...keys, name].slice(-MAX_SELECTED)
    )

    return <div className="main-panel">
        <div className="state-list" style={{ width: listWidth }}>
            <input
                type="search"
                placeholder="Filter stores…"
                aria-label="Filter stores"
                className="state-filter"
                value={filterString}
                onChange={ev => setFilterString(ev.target.value)}
            />
            <HightlightWrapper highlight={filterString}>
                {groups.length === 0 && <div className="state-empty">{names.length === 0 ? "No store mounted" : "No match"}</div>}
                {groups.map(([group, instances]) => {
                    const [scope, storeName] = splitScope(group)
                    return <Fragment key={group}>
                        <div className="state-group-header">
                            <HighlightString text={storeName} />
                            {scope && <small> {scope}</small>}
                        </div>
                        {instances.map(name => <StateLabelRender
                            key={name}
                            name={name}
                            label={paramsLabel(name)}
                            selected={selectedKeys.includes(name)}
                            onToggle={() => toggleSelected(name)}
                        />)}
                    </Fragment>
                })}
            </HightlightWrapper>
        </div>
        <div className="state-list-resize" onPointerDown={onPointerDown} role="separator" aria-orientation="vertical" />
        <div className="state-views">
            {selectedKeys.length === 0 && <div className="state-empty">Select a store to inspect it. Up to {MAX_SELECTED} side by side.</div>}
            {selectedKeys.map(name => <StateView
                key={name}
                dataKey={name}
                Component={Component}
                onClose={() => toggleSelected(name)}
            />)}
        </div>
    </div>
}

/**
 * Live view of one store instance by full context name. Read-only: it never creates a context
 * (that would resurrect an evicted store), and shows the last data with an "unmounted" badge once
 * the store is gone, then follows the new instance if the store is mounted again.
 */
export const StateView: React.FC<{ dataKey: string, Component?: DataViewComponent, onClose?: () => void }> = ({ dataKey, Component = DataViewDefault, onClose }) => {
    useCacheVersion()
    const ctx = getContext.fromCache(dataKey)
    const [data, setData] = useState(() => ({ ...ctx?.data }))
    const seenCtx = useRef(ctx)

    useEffect(() => {
        if (seenCtx.current !== ctx) {
            // a new instance under the same name (or the store went away): show its data, not the old one's
            seenCtx.current = ctx
            if (ctx) setData({ ...ctx.data })
        }
        if (!ctx) return
        const update = debounce(() => setData({ ...ctx.data }), 5)
        const unsubscribe = ctx.subscribeAll(update)
        return () => {
            update.cancel()
            unsubscribe()
        }
    }, [ctx])

    const [scope, storeName] = splitScope(groupOf(dataKey))
    return <div className="state-view" data-store={dataKey}>
        <div className="state-view-header" title={dataKey}>
            <span className="state-view-name">{storeName}</span>
            <span className="state-view-params">{paramsLabel(dataKey)}</span>
            {scope && <span className="state-badge">{scope}</span>}
            {!ctx && <span className="state-badge state-badge-gone">unmounted</span>}
            {ctx && !ctx.ready && <span className="state-badge">initial</span>}
            {onClose && <button type="button" className="state-view-close" onClick={onClose} aria-label={`Close ${dataKey}`}>×</button>}
        </div>
        <div className="state-view-body">
            <Component value={data} name={dataKey} />
        </div>
    </div>
}
