import { DevToolContainer } from "react-state-custom/dev-tool"
import { ObjectDataView } from "react-state-custom/dev-tool/obj-view"
import "react-state-custom/style.css"
import "react-obj-view/dist/react-obj-view.css"

export const DevToolToggleBtn = () => <DevToolContainer
  Component={ObjectDataView}
  style={{ left: "20px", bottom: "10px", right: "unset" }}
/>
