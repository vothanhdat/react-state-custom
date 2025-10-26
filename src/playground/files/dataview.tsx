
import { ObjectView } from "react-obj-view"
import { DataViewComponent } from "react-state-custom"
import "react-obj-view/dist/react-obj-view.css"

export const DataView: DataViewComponent = ({ name, value }) => {
  return <ObjectView
    {...{ name, value }}
    expandLevel={1}
  />
}
