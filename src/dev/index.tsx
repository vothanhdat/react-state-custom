import { createRoot } from 'react-dom/client'
import { Dev } from './Dev'
import { AutoRootCtx } from '../state-utils/createAutoCtx'
import { DataViewComponent } from '../dev-tool/DataViewComponent'
import { ObjectView } from 'react-obj-view'
import 'react-obj-view/dist/react-obj-view.css'
import { DevToolContainer } from '../dev-tool/DevTool'
import { StrictMode } from 'react'


// Custom data view component
const DataView: DataViewComponent = ({ name, value }) => {
    return <ObjectView {...{ name, value }} expandLevel={1} />
}

createRoot(document.getElementById('root')!)
    .render(<>
        <StrictMode>
            <AutoRootCtx />
            <Dev />
            <DevToolContainer
                Component={DataView}
                style={{ left: '20px', bottom: '20px', right: 'unset' }}
            />
        </StrictMode>
    </>)
