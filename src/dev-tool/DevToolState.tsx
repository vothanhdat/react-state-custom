import React, { Fragment, useEffect, useMemo, useState } from "react"
import { getContext } from "../state-utils/ctx"
import { debounce } from "../state-utils/utils"
import { HighlightString, HightlightWrapper } from "./useHighlight"
import { DataViewComponent, DataViewDefault } from "./DataViewComponent"
import { StateLabelRender } from "./StateLabelRender"
import Split from "@uiw/react-split"
import "./DevTool.css"

const cache = getContext.cache

export const DevToolState: React.FC<{ Component: DataViewComponent }> = ({ Component }) => {
    const [allKeys, setKeys] = useState(() => [...cache.keys()])
    const [filterString, setFilterString] = useState("")
    const [selectedKeys, setSelectedKeys] = useState<string[]>([])

    useEffect(() => {
        let t = setInterval(() => {
            setKeys(k => k.length != cache.size
                ? [...cache.keys()]
                : k
            )
        }, 50)
        return () => clearInterval(t)
    }, [cache])

    const filterFn = useMemo(
        () => {
            const preFilter = filterString
                .toLowerCase()
                .split(" ")
            return (e: string) => {
                const sLow = e.toLowerCase()
                return preFilter.every(token => sLow.includes(token))
            }
        },
        [filterString]
    )

    const preParseKeys = useMemo(
        () => allKeys.map((e): string => JSON.parse(e)?.[0]),
        [allKeys]
    )

    const groupedKeys = useMemo(
        () => preParseKeys
            // hide the internal auto-ctx of every scope (scoped names are "<scopeId>/auto-ctx")
            .filter(e => e && !/(^|\/)auto-ctx$/.test(e))
            .filter(filterFn)
            .reduce<Record<string, string[]>>((groups, key) => {
                const group = key.split("?")[0] ?? key
                    ; (groups[group] ??= []).push(key)
                return groups
            }, {}),
        [preParseKeys, filterFn]
    )

    return <Split mode="horizontal" className="main-panel" visible>
        <div className="state-list">
            <input
                placeholder="Type to Filter ..."
                className="state-filter"
                value={filterString}
                onChange={(ev) => setFilterString(ev.target.value)}
            />
            <HightlightWrapper highlight={filterString}>
                {Object.entries(groupedKeys)
                    .map(([name, values]) => <Fragment key={name}>
                        <div className="state-group-header">
                            {/* scoped stores are named "<scopeId>/<name>": show the name, then the scope */}
                            <HighlightString text={name.slice(name.lastIndexOf('/') + 1)} />
                            {name.includes('/') && <small> {name.slice(0, name.lastIndexOf('/'))}</small>}
                        </div>
                        {values.map(currentKey => <StateLabelRender
                            key={currentKey}
                            {...{ selectedKeys, setSelectedKeys, currentKey, label: currentKey.split("?").at(-1) }}
                        />)}
                    </Fragment>)}
            </HightlightWrapper>
        </div>
        {selectedKeys?.map(selectedKey => <div className="state-view" key={selectedKey}>
            <StateView dataKey={selectedKey} key={selectedKey} Component={Component} />
        </div>)}

    </Split>
}

export const StateView: React.FC<{ dataKey: string, Component: DataViewComponent }> = ({ dataKey, Component = DataViewDefault }) => {
    // read-only: never create a context from the dev tool, that would resurrect evicted stores
    const ctx = getContext.fromCache(dataKey)
    const [currentData, setCurrentData] = useState({ ...ctx?.data })

    useEffect(() => {
        if (!ctx) return
        let updateDataDebounce = debounce(setCurrentData, 5)
        const unsub = ctx.subscribeAll((_changeKey, newData) => updateDataDebounce({ ...newData }))
        return () => {
            updateDataDebounce.cancel()
            unsub()
        }
    }, [ctx])

    return <Component
        value={currentData}
        name={dataKey}
    />
}
