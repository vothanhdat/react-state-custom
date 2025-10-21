import React, { useEffect, useMemo, useRef, useState } from "react"
import "./devTool.css"
import { getContext } from "../state-utils/ctx"
import { debounce } from "../state-utils/utils"
import { HightlightWrapper, HighlightString } from "./useHighlight"
import { JSONView } from "./JSONView"

const cache = getContext.cache

export const DevToolState = ({ }) => {
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


    return <div className="main-panel">
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
                    .map(e => <SelectedKeyRender {...{ selectedKey, setKey, currentKey: e, }} />)}
            </HightlightWrapper>

        </div>
        <div className="state-view" >
            <StateView dataKey={selectedKey} key={selectedKey} />
        </div>
    </div>
}

const SelectedKeyRender: React.FC<any> = ({ selectedKey, setKey, currentKey, highlight, ...props }) => {
    const ctx = getContext(currentKey)
    const divRef = useRef<HTMLDivElement>(undefined)

    useEffect(() => {
        if (divRef.current) {
            let flashKeyDebounce = debounce(() => {
                if (divRef.current) {
                    divRef.current?.classList.add("state-key-updated");
                    requestAnimationFrame(() => divRef.current?.classList.remove("state-key-updated"));
                }
            }, 16);
            return ctx.subscribeAll(flashKeyDebounce)
        }

    }, [ctx, divRef])

    return <div
        ref={divRef}
        className="state-key"
        title={currentKey}
        data-active={currentKey == selectedKey}
        onClick={() => setKey(currentKey)}
        {...props}
    >
        <div className="state-key-name">
            <HighlightString text={String(currentKey)} />
        </div>
        <div className="state-key-meta">
            {Object.keys(ctx.data).length} items
        </div>
    </div>
}

export const StateView: React.FC<{ dataKey: string }> = ({ dataKey }) => {
    const ctx = getContext(dataKey)
    const [currentData, setCurrentData] = useState({ ...ctx?.data })

    useEffect(() => {
        let updateDataDebounce = debounce(setCurrentData, 16)
        return ctx
            .subscribeAll((changeKey, newData) => updateDataDebounce({ ...newData }))

    }, [ctx])

    return <JSONView
        value={currentData}
        name={dataKey}
        expandLevel={1}
        style={{}}
    />
}

export const DevToolContainer = ({ toggleButton = "[x]", ...props }) => {
    const [active, setActive] = useState(false);
    return <>
        <button className="react-state-dev-btn" data-active={active} onClick={() => setActive(true)} {...props}>
            {props?.children ?? "Toggle Dev Tool"}
        </button>
        <div className="react-state-dev-container" data-active={active}>
            <button className="close-btn" onClick={() => setActive(false)}>
                [x]
            </button>
            {active && <DevToolState />}
        </div>
    </>
}