import "./devTool.css"
import { useState } from "react"
import { DevToolState } from "./DevToolState";


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