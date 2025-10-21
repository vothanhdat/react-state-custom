import React, { type Dispatch, type SetStateAction, useMemo, useCallback, useRef, useEffect, useState } from "react";

type JSONViewProps = {
    value: any;
    path?: string[];
    name?: string;
    expandRoot: Record<string, boolean>;
    setExpandRoot: Dispatch<SetStateAction<Record<string, boolean>>>;
    expandLevel: number | boolean;
    // currentField?: any
    currentType?: any;
    isGrouped?: boolean;
};

class GroupedObject {
    constructor(
        public obj: any,
        public keys = Object.keys(obj),
        public from = 0,
        public to = keys.length
    ) { }

    getSize() {
        return this.to - this.from;
    }

    getKey(maxLength = 10) {
        return this.obj instanceof Array
            ? `${this.from}..${this.to}`
            : `${this.keys[this.from]?.slice(0, maxLength)}..${this.keys[this.to - 1]?.slice(0, maxLength)}`;
    }

    getKeys() {
        return this.keys.slice(this.from, this.to);
    }

    getObject() {
        return Object.fromEntries(
            this.keys.slice(this.from, this.to)
                .map(k => [k, this.obj[k]])
        );
    }

}

const toGrouped = (grouped: GroupedObject, max = 10) => {
    let size = grouped.getSize();
    let seperator = max ** Math.floor(Math.log(size - 1) / Math.log(max));
    if (seperator > 0) {
        return new Array(Math.ceil((size - 1) / seperator))
            .fill(0).map((_, i) => new GroupedObject(
                grouped.obj,
                grouped.keys,
                grouped.from + i * seperator,
                Math.min(grouped.from + (i + 1) * seperator, grouped.to)
            ));
    } else {
        return [grouped];
    }
};

const useExpandState = ({ path, expandLevel, expandRoot, setExpandRoot }: JSONViewProps) => {
    const expandKeys = path?.join("/") ?? "";

    const defaultExpand = typeof expandLevel == "boolean"
        ? expandLevel
        : (typeof expandLevel == 'number' && expandLevel > 0);

    const isExpand = useMemo(
        () => expandRoot?.[expandKeys] ?? defaultExpand,
        [expandRoot?.[expandKeys], expandKeys]
    );

    const setExpand = useCallback(
        (value: boolean) => setExpandRoot((r: object) => ({ ...r, [expandKeys]: value })),
        [expandRoot, expandKeys]
    );

    return { isExpand, setExpand, expandKeys };

};

export const ChangeFlashWrappper: React.FC<React.ComponentProps<'div'> & { value: any; }> = ({ value, ...rest }) => {

    const ref = useRef<HTMLElement>(undefined);
    const refValue = useRef(value);

    useEffect(() => {
        if (ref.current) {
            const p = performance.now();
            let tmp1: any, tmp2: any;
            let isDiff = value instanceof GroupedObject && refValue.current instanceof GroupedObject
                ? (
                    value.getSize() != refValue.current.getSize()
                    || (tmp1 = value.obj, tmp2 = refValue.current.obj, value.getKeys().some(k => tmp1[k] != tmp2[k]))
                ) : (
                    value != refValue.current
                );
            const p1 = performance.now();

            if (p1 - p >= 1) {
                console.warn("Slow Compare perfomance", { time: p1 - p, size: value?.getSize?.(), value });
            }

            if (isDiff) {
                refValue.current = value;
                ref.current.classList.add('jv-updated');
                let t = requestAnimationFrame(() => ref.current?.classList.remove('jv-updated'));
                return () => cancelAnimationFrame(t);
            }
        }

    }, [value, ref]);

    return <div {...rest} ref={ref as any} />;
};

const JSONViewObj: React.FC<JSONViewProps> = (props) => {

    const {
        value, path = [], name, expandRoot, setExpandRoot, expandLevel,
    } = props;

    const { isExpand, setExpand, expandKeys } = useExpandState(props);

    const childExpandLevel = typeof expandLevel == "number" ? expandLevel - 1 : expandLevel;

    const { isArray, size, shouldGroup, ableToExpand, groupedChilds } = useMemo(
        () => {

            if (value instanceof GroupedObject) {
                const isArray = value.obj instanceof Array;
                const size = value.getSize();
                const groupdSize = isArray ? 10 : 25;
                const shouldGroup = size > groupdSize;
                const ableToExpand = size > 0;

                const groupedChilds = shouldGroup
                    ? Object.fromEntries(
                        toGrouped(value, groupdSize)
                            .map(g => [g.getKey(), g])
                    )
                    : value.getObject();

                return { size, isArray, shouldGroup, ableToExpand, groupedChilds, };
            } else {
                const isArray = value instanceof Array;
                const size = isArray ? value.length : Object.keys(value).length;
                const groupdSize = isArray ? 10 : 25;
                const shouldGroup = size > groupdSize;

                const ableToExpand = size > 0;

                const groupedChilds = shouldGroup
                    ? Object.fromEntries(
                        toGrouped(new GroupedObject(value), groupdSize)
                            .map(g => [g.getKey(), g])
                    )
                    : value;

                return { isArray, size, shouldGroup, ableToExpand, groupedChilds, };
            }
        },
        [value]
    );


    return <ChangeFlashWrappper className="jv-field jv-field-obj" value={value}>
        {isExpand && ableToExpand ? <>
            {name && <div>
                <div onClick={() => setExpand(false)}>
                    <span className="jv-name">{name}</span>
                    <span>:</span>
                    <span>[-]</span>
                    <span className="jv-type">{size} items </span>
                    <span> {isArray ? "[" : "{"} </span>
                </div>
            </div>}
            <div className="jv-value">
                {Object
                    .entries(groupedChilds)
                    .map(([name, value], index) => ({
                        name, value,
                        path: [...path, value instanceof GroupedObject ? String(index) : name]
                    }))
                    .map(({ name, value, path }) => <JSONViewCurr
                        {...{
                            name,
                            value,
                            path,
                            expandRoot, setExpandRoot,
                            expandLevel: childExpandLevel,
                            isGrouped: shouldGroup,
                        }}
                        key={path.join("/")} />)}
            </div>
            {name && <div>
                <span> {isArray ? "]" : "}"} </span>
            </div>}
        </> : <>
            <div>
                <div onClick={() => ableToExpand && setExpand(true)}>
                    <span className="jv-name">{name}</span>
                    {name && <span>:</span>}
                    {name && ableToExpand && <span>[+]</span>}
                    <span className="jv-type">{size} items </span>
                    <span> {isArray ? "[" : "{"} </span>
                    {ableToExpand && <PreviewObj {...{ value, size, }} />}
                    <span> {isArray ? "]" : "}"} </span>
                </div>
            </div>
        </>}
    </ChangeFlashWrappper>;
};

const PreviewObj: React.FC<{ size: number; value: any; }> = ({ }) => {
    return <span className="jv-preview"> ... </span>;
};

const StringViewObj: React.FC<JSONViewProps> = (props) => {

    const { currentType, name, value, } = props;

    const { isExpand, setExpand } = useExpandState(props);

    const useExpand = String(value).length > 50;

    const renderString = useExpand && !isExpand
        ? `${String(value).slice(0, 15)}...${String(value).slice(-15, -1)}`
        : String(value);

    return <ChangeFlashWrappper
        value={props.value}
        className={`jv-field jv-field-${currentType} ${useExpand ? 'jv-cursor' : ''}`}
        onClick={() => setExpand(!isExpand)}>
        <span className="jv-name">{name}</span>
        <span>:</span>
        <span className="jv-type">{currentType}, lng={value?.length}</span>
        <span className="jv-value">"{renderString}"</span>
        <span>,</span>
    </ChangeFlashWrappper>;
};

const FunctionViewObj: React.FC<JSONViewProps> = (props) => {
    const { currentType, name, value, } = props;
    const { isExpand, setExpand } = useExpandState(props);
    const fnString = String(value).trim()
    const useExpand = fnString.length > 50;
    const renderString = useExpand && !isExpand
        ? `${fnString.slice(0, 15)}...${fnString.slice(-15)}`
        : fnString;
    return <ChangeFlashWrappper
        value={props.value}
        className={`jv-field jv-field-${currentType} ${useExpand ? 'jv-cursor' : ''}`}
        onClick={() => setExpand(!isExpand)}>
        <span className="jv-name">{name}</span>
        <span>:</span>
        <span className="jv-type">{currentType}</span>
        <span className="jv-value">"{renderString}"</span>
        <span>,</span>
    </ChangeFlashWrappper>;
};

const DefaultValueView: React.FC<JSONViewProps> = (props) => {

    const { currentType, name, value, } = props;

    return <ChangeFlashWrappper
        value={props.value}
        className={`jv-field jv-field-${currentType}`}>
        <span className="jv-name">{name}</span>
        <span>:</span>
        <span className="jv-type">{currentType}</span>
        <span className="jv-value">{String(value)}</span>
        <span>,</span>
    </ChangeFlashWrappper>;
};

const JSONViewCurr: React.FC<Omit<JSONViewProps, 'currentField'>> = (props) => {

    const { value, path = [], name, } = props;

    const currentField = path.at(-1) ?? name ?? undefined;

    const currentType = typeof value;

    switch (currentType) {
        case "object":
            return <JSONViewObj {...props} {...{ currentField, currentType }} />;
        case "string":
            return <StringViewObj {...props} {...{ currentField, currentType }} />;
        case "function":
            return <FunctionViewObj {...props} {...{ currentField, currentType }} />;
        case "number":
        case "boolean":
        case "bigint":
        case "symbol":
        case "undefined":
        default:
            return <DefaultValueView {...props} {...{ currentField, currentType }} />;
    }
};

export const JSONView: React.FC<{ value: any; name?: string; style?: any; expandLevel?: number | boolean; }> = ({ value, name, style, expandLevel = false }) => {

    const [expandRoot, setExpandRoot] = useState<Record<string, boolean>>({});

    return <div className="jv-root" style={style}>
        <JSONViewCurr
            path={[]}
            {...{ name, value, expandRoot, setExpandRoot, expandLevel }} />
    </div>;
};
