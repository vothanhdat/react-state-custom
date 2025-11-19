
import { ObjectView } from "react-obj-view"
import { DataViewComponent, DevToolContainer } from "react-state-custom"
import "react-state-custom/dist/react-state-custom.css"
import "react-obj-view/dist/react-obj-view.css"

const DataView: DataViewComponent = ({ name, value }) => {
  return <ObjectView
    valueGetter={() => value}
    expandLevel={5}
    name={name}
    showLineNumbers
    // nonEnumerable
    includeSymbols
  />
}

export const DevToolToggleBtn = ({ }) => <DevToolContainer
  Component={DataView}
  style={{ left: "20px", bottom: "10px", right: "unset" }}
/>