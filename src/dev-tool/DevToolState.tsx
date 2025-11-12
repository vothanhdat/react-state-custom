import React, { useEffect, useMemo, useState } from "react"
import { getContext } from "../state-utils/ctx"
import { debounce } from "../state-utils/utils"
import { HightlightWrapper } from "./useHighlight"
import { DataViewComponent, DataViewDefault } from "./DataViewComponent"
import { StateLabelRender } from "./StateLabelRender"
import Split from "@uiw/react-split"
import "./DevTool.css"

const cache = getContext.cache

export const DevToolState: React.FC<{ Component: DataViewComponent }> = ({ Component }) => {
    const [allKeys, setKeys] = useState(() => [...cache.keys()])
    const [filterString, setFilterString] = useState("")
    const [selectedKey, setKey] = useState("")

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


    return <Split mode="horizontal" className="main-panel">
        <div className="state-list">
            <input
                placeholder="Type to Filter ..."
                className="state-filter"
                value={filterString}
                onChange={(ev) => setFilterString(ev.target.value)}
            />
            <HightlightWrapper highlight={filterString}>
                {allKeys
                    .map(e => JSON.parse(e)?.[0])
                    .filter(e => e != "auto-ctx" && e)
                    .filter(filterFn)
                    .map(currentKey => <StateLabelRender key={currentKey} {...{ selectedKey, setKey, currentKey }} />)}
            </HightlightWrapper>

        </div>
        <div className="state-view" >
            <StateView dataKey={selectedKey} key={selectedKey} Component={Component} />
        </div>
    </Split>
}

export const StateView: React.FC<{ dataKey: string, Component: DataViewComponent }> = ({ dataKey, Component = DataViewDefault }) => {
    const ctx = getContext(dataKey)
    const [currentData, setCurrentData] = useState({ ...ctx?.data })

    useEffect(() => {
        let updateDataDebounce = debounce(setCurrentData, 5)
        return ctx
            .subscribeAll((changeKey, newData) => updateDataDebounce({ ...newData }))

    }, [ctx])

    return <Component
        value={currentData}
        name={dataKey}
    />
}
