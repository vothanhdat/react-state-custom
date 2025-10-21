import { getContext } from "./state-utils/ctx"
import React, { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from "react"
import "./devTool.css"
import { debounce } from "./state-utils/utils"

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

            {allKeys
                .map(e => JSON.parse(e)?.[0])
                .filter(e => e != "auto-ctx" && e)
                .filter(filterFn)
                .map(e => <SelectedKeyRender {...{
                    selectedKey, setKey,
                    currentKey: e
                }} />)}
        </div>
        <div className="state-view" >
            <StateView dataKey={selectedKey} key={selectedKey} />
        </div>
    </div>
}

const SelectedKeyRender: React.FC<any> = ({ selectedKey, setKey, currentKey, ...props }) => {
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
        data-active={currentKey == selectedKey}
        onClick={() => setKey(currentKey)}
        {...props}
    >
        {currentKey}
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

type JSONViewProps = {
    value: any,
    path?: string[],
    name?: string,
    expandRoot: Record<string, boolean>,
    setExpandRoot: Dispatch<SetStateAction<Record<string, boolean>>>,
    expandLevel: number | boolean,
    currentField?: any
    currentType?: any,
    isGrouped?: boolean,
}

const splitArray = <T,>(array: T[]) => {
    let max = array.length < 120 ? 10 : 100
    return Object.fromEntries(
        new Array(Math.ceil((array.length + 1) / max))
            .fill(0)
            .map((_, i, a) => new Array(i == a.length - 1 ? array.length % max : max)
                .fill(0)
                .map((_, j) => i * max + j)
            )
            .filter(e => e.length)
            .map(keys => [`${keys.at(0)}..${keys.at(-1)}`, Object.fromEntries(
                keys.map(k => [k, array[k]])
            )])
    )
}


const splitObject = (object: any, max = 25) => {
    const keys = Object.keys(object);
    return Object.fromEntries(
        Array(Math.ceil((keys.length + 1) / max))
            .fill(0)
            .map((_, i, a) => new Array(i == a.length - 1 ? keys.length % max : max)
                .fill(0)
                .map((_, j) => i * max + j)
            )
            .filter(e => e.length)
            .map((e) => e.map(i => keys.at(i)))
            .map(sortedKeys => [
                `${sortedKeys.at(0)?.slice(0, 15)}...${sortedKeys.at(-1)?.slice(0, 15)}`,
                Object.fromEntries(sortedKeys.map(key => [key, object[key as any]]))]
            )
    )
}


const useExpandState = ({ path, expandLevel, expandRoot, setExpandRoot }: JSONViewProps) => {
    const expandKeys = path?.join("%") ?? "";

    const defaultExpand = typeof expandLevel == "boolean"
        ? expandLevel
        : (typeof expandLevel == 'number' && expandLevel > 0)

    const isExpand = useMemo(
        () => expandRoot?.[expandKeys] ?? defaultExpand,
        [expandRoot?.[expandKeys], expandKeys]
    )

    const setExpand = useCallback(
        (value: boolean) => setExpandRoot((r: object) => ({ ...r, [expandKeys]: value })),
        [expandRoot, expandKeys]
    )

    return { isExpand, setExpand }

}

export const ChangeFlashWrappper: React.FC<React.ComponentProps<'div'> & { value: any, deepCompare?: boolean }> = ({ value, deepCompare = false, ...rest }) => {

    const ref = useRef<HTMLElement>(undefined)
    const refValue = useRef(value);

    useEffect(() => {
        if (ref.current) {
            let isDiff = deepCompare && value && refValue.current
                ? (
                    Object.keys(value).length != Object.keys(refValue.current).length
                    || Object.keys(value).some(key => value[key] != refValue.current[key])
                ) : (
                    value != refValue.current
                )
            if (isDiff) {
                refValue.current = value;
                ref.current.classList.add('jv-updated');
                let t = requestAnimationFrame(() => ref.current?.classList.remove('jv-updated'));
                return () => cancelAnimationFrame(t)
            }
        }

    }, [value, deepCompare, ref])

    return <div  {...rest} ref={ref as any} />
}

const JSONViewObj: React.FC<JSONViewProps> = (props) => {

    const {
        currentField,
        value, path = [], name, expandRoot, setExpandRoot,
        expandLevel,
        isGrouped,
    } = props

    const isArray = value instanceof Array

    const { isExpand, setExpand } = useExpandState(props)

    const childExpandLevel = typeof expandLevel == "number" ? expandLevel - 1 : expandLevel

    const shouldGroup = Object.entries(value).length > (value instanceof Array ? 10 : 25);

    const ableToExpand = Object.entries(value).length > 0

    const groupedChilds = useMemo(
        () => shouldGroup
            ? (value instanceof Array) ? splitArray(value) : splitObject(value, 25)
            : value,
        [value, shouldGroup, splitArray]
    )


    return (isExpand && ableToExpand) ? <ChangeFlashWrappper className="jv-field jv-field-obj" value={value} deepCompare={isGrouped}>
        {currentField && <div>
            <div onClick={() => setExpand(false)}>
                <span className="jv-name">{currentField}</span>
                <span>:</span>
                <span>[-]</span>
                <span className="jv-type">{Object.keys(value).length} items </span>
                <span> {isArray ? "[" : "{"} </span>
            </div>
        </div>}
        <div className="jv-value">
            {Object
                .entries(groupedChilds)
                .map(([k, v], index) => <JSONViewCurr
                    {...{
                        name, expandRoot, setExpandRoot,
                        expandLevel: childExpandLevel,
                        value: v,
                        isGrouped: shouldGroup,
                    }}
                    key={[...path, shouldGroup ? index : k].join("%")}
                    path={[...path, k]}
                />)}
        </div>
        {currentField && <div>
            <span> {isArray ? "]" : "}"} </span>
        </div>}
    </ChangeFlashWrappper> : <ChangeFlashWrappper className="jv-field jv-field-obj" value={value} deepCompare={isGrouped}>
        <div>
            <div onClick={() => ableToExpand && setExpand(true)}>
                <span className="jv-name">{currentField}</span>
                {currentField && <span>:</span>}
                {currentField && ableToExpand && <span>[+]</span>}
                <span className="jv-type">{Object.keys(value).length} items </span>
                <span> {isArray ? "[" : "{"} </span>
                {ableToExpand && <span> ... </span>}
                <span> {isArray ? "]" : "}"} </span>
            </div>
        </div>
    </ChangeFlashWrappper>

}

const StringViewObj: React.FC<JSONViewProps> = (props) => {

    const { currentType, currentField, value, } = props

    const { isExpand, setExpand } = useExpandState(props)

    const useExpand = String(value).length > 50

    const renderString = useExpand && !isExpand
        ? `${String(value).slice(0, 15)}...${String(value).slice(-15, -1)}`
        : String(value)

    return <ChangeFlashWrappper
        value={props.value}
        className={`jv-field jv-field-${currentType} ${useExpand ? 'jv-cursor' : ''}`}
        onClick={() => setExpand(!isExpand)}>
        <span className="jv-name">{currentField}</span>
        <span>:</span>
        <span className="jv-type">{currentType}, lng={value?.length}</span>
        <span className="jv-value">"{renderString}"</span>
        <span>,</span>
    </ChangeFlashWrappper>
}

const FunctionViewObj: React.FC<JSONViewProps> = (props) => {

    const { currentType, currentField, value, } = props

    const { isExpand, setExpand } = useExpandState(props)

    const useExpand = String(value).length > 50

    const renderString = useExpand && !isExpand
        ? `${String(value).slice(0, 15)}...${String(value).slice(-15, -1)}`
        : String(value)

    return <ChangeFlashWrappper
        value={props.value}
        className={`jv-field jv-field-${currentType} ${useExpand ? 'jv-cursor' : ''}`}
        onClick={() => setExpand(!isExpand)}>
        <span className="jv-name">{currentField}</span>
        <span>:</span>
        <span className="jv-type">{currentType}</span>
        <span className="jv-value">"{renderString}"</span>
        <span>,</span>
    </ChangeFlashWrappper>
}

const DefaultValueView: React.FC<JSONViewProps> = (props) => {

    const { currentType, currentField, value, } = props

    return <ChangeFlashWrappper
        value={props.value}
        className={`jv-field jv-field-${currentType}`}>
        <span className="jv-name">{currentField}</span>
        <span>:</span>
        <span className="jv-type">{currentType}</span>
        <span className="jv-value">{String(value)}</span>
        <span>,</span>
    </ChangeFlashWrappper>
}

const JSONViewCurr: React.FC<Omit<JSONViewProps, 'currentField'>> = (props) => {

    const { value, path = [], name } = props

    const currentField = path.at(-1) ?? name ?? undefined;

    const currentType = typeof value

    switch (currentType) {
        case "object":
            return <JSONViewObj {...props} {...{ currentField, currentType }} />
        case "string":
            return <StringViewObj {...props} {...{ currentField, currentType }} />
        case "function":
            return <FunctionViewObj {...props} {...{ currentField, currentType }} />
        case "number":
        case "boolean":
        case "bigint":
        case "symbol":
        case "undefined":
        default:
            return <DefaultValueView  {...props} {...{ currentField, currentType }} />
    }
}

export const JSONView: React.FC<{ value: any, name?: string, style?: any, expandLevel?: number | boolean }> = ({ value, name, style, expandLevel = false }) => {

    const [expandRoot, setExpandRoot] = useState<Record<string, boolean>>({})

    return <div className="jv-root" style={style}>
        <JSONViewCurr
            path={[]}
            {...{ name, value, expandRoot, setExpandRoot, expandLevel }}
        />
    </div>
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