
import { ObjectView } from "react-obj-view"
import { DataViewComponent, DevToolContainer } from "react-state-custom"
import "react-state-custom/dist/react-state-custom.css"
import "react-obj-view/dist/react-obj-view.css"

const DataView: DataViewComponent = ({ name, value }) => {
  return <ObjectView
    {...{ name, value }}
    expandLevel={1}
  />
}

export const DevToolToggleBtn = ({ }) => <DevToolContainer
  Component={DataView}
  style={{ left: "20px", bottom: "10px", right: "unset" }}
/>