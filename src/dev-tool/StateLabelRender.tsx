import React, { useRef, useEffect } from "react";
import { getContext } from "../state-utils/ctx";
import { debounce } from "../state-utils/utils";
import { HighlightString } from "./useHighlight";

export const StateLabelRender: React.FC<{
    selectedKeys: string[]
    setSelectedKeys: React.Dispatch<React.SetStateAction<string[]>>
    currentKey: string
    label?: string
    highlight?: string
    [prop: string]: unknown
}> = ({
    selectedKeys, setSelectedKeys,
    currentKey,
    label = currentKey,
    highlight,
    ...props
}) => {

    const ctx = getContext.fromCache(currentKey)

    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (divRef.current && ctx) {
            let flashKeyDebounce = debounce(() => {
                if (divRef.current) {
                    divRef.current?.classList.add("state-key-updated");
                    requestAnimationFrame(() => divRef.current?.classList.remove("state-key-updated"));
                }
            }, 5);
            return ctx.subscribeAll(flashKeyDebounce);
        }

    }, [ctx, divRef]);

    return <div
        ref={divRef}
        className="state-key"
        title={currentKey}
        data-active={selectedKeys.includes(currentKey)}
        onClick={() => selectedKeys.includes(currentKey)
            ? setSelectedKeys(keys => keys.filter(e => e != currentKey))
            : setSelectedKeys(keys => [...keys, currentKey].slice(-5))
        }
        {...props}
    >
        <div className="state-key-name">
            <HighlightString text={label} />
        </div>
        <div className="state-key-meta">
            {Object.keys(ctx?.data ?? {}).length} items
        </div>
    </div>;
};
