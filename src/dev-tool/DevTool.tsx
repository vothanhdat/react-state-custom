import "./DevTool.css"
import { useState } from "react"
import { DevToolState } from "./DevToolState";
import { DataViewDefault } from "./DataViewComponent";
import Split from '@uiw/react-split';


export const DevToolContainer = ({ toggleButton = "[x]", Component = DataViewDefault, ...props }) => {
    const [active, setActive] = useState(false);
    return <>
        <button className="react-state-dev-btn" data-active={active} onClick={() => setActive(true)} {...props}>
            {props?.children ?? "Toggle Dev Tool"}
        </button>
        <div className="react-state-dev-container">
            <Split mode="vertical" style={{ height: "100%" }}>
                <div style={{ height: active ? "66.66%" : "100%" }}></div>
                <div className="react-state-dev-panel" style={{
                    height: active ? "33.33%" : "0",
                    backgroundColor: "var(--rs-bg-color)",
                    position: "relative"
                }}>
                    {active && <button
                        className="close-btn"
                        onClick={() => setActive(false)}
                    >
                        [x]
                    </button>}
                    {active && <DevToolState Component={Component} />}
                </div>
            </Split>
        </div>
    </>
}