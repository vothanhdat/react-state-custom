import { createRoot } from 'react-dom/client'
import { DevToolContainer } from './dev-tool/DevTool'
import { AutoRootCtx, createAutoCtx } from './state-utils/createAutoCtx'
import { Test } from './Test'
import { DataViewComponent } from './dev-tool/DataViewComponent'
import { ObjectView } from "react-obj-view"
import "react-obj-view/dist/react-obj-view.css"


const DataView: DataViewComponent = ({ name, value }) => {
  return <ObjectView
    {...{ name, value }}
    expandLevel={1}
  />
}

createRoot(document.getElementById('root')!).render(
  <>
    <DevToolContainer Component={DataView} />
    <Test />
    <AutoRootCtx />
  </>
)
