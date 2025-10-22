import React, { useRef, useEffect } from "react";
import { getContext } from "../state-utils/ctx";
import { debounce } from "../state-utils/utils";
import { HighlightString } from "./useHighlight";

export const StateLabelRender: React.FC<any> = ({ selectedKey, setKey, currentKey, highlight, ...props }) => {
    const ctx = getContext(currentKey);
    const divRef = useRef<HTMLDivElement>(undefined);

    useEffect(() => {
        if (divRef.current) {
            let flashKeyDebounce = debounce(() => {
                if (divRef.current) {
                    divRef.current?.classList.add("state-key-updated");
                    requestAnimationFrame(() => divRef.current?.classList.remove("state-key-updated"));
                }
            }, 16);
            return ctx.subscribeAll(flashKeyDebounce);
        }

    }, [ctx, divRef]);

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
    </div>;
};
