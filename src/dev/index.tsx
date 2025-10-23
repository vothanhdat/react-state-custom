import { createRoot } from 'react-dom/client'
import { Dev } from './Dev'
import "react-obj-view/dist/react-obj-view.css"
import { AutoRootCtx } from '../state-utils/createAutoCtx'
import { DevToolContainer } from '../dev-tool/DevTool'
import { DataViewComponent } from '../dev-tool/DataViewComponent'


import { ObjectView } from "react-obj-view"
import "react-obj-view/dist/react-obj-view.css"


const DataView: DataViewComponent = ({ name, value }) => <ObjectView
    {...{ name, value }}
    expandLevel={1}
/>

createRoot(document.getElementById('root')!)
    .render(<>
        <Dev />
        <AutoRootCtx />
        <DevToolContainer Component={DataView} />
    </>)
