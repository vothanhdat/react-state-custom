import { createRoot } from 'react-dom/client'
import { Dev } from './Dev'
import { AutoRootCtx } from '../state-utils/createAutoCtx'
import { DataViewComponent } from '../dev-tool/DataViewComponent'
import { ObjectView } from 'react-obj-view'
import 'react-obj-view/dist/react-obj-view.css'
import { DevToolContainer } from '../dev-tool/DevTool'
import { StrictMode } from 'react'
import { ErrorBoundary } from "react-error-boundary";


// Custom data view component
const DataView: DataViewComponent = ({ name, value }) => {
    return <ObjectView {...{ name, value }} expandLevel={1} />
}

const fallbackRender = ({ error, resetErrorBoundary }: any) => {
    return (
        <div role="alert" style={{padding:"2em"}}>
            <p>Something went wrong:</p>
            <ObjectView value={error} expandLevel={3} />
            <br/>
            <button onClick={resetErrorBoundary}>Close</button>
        </div>
    );
}

const ErrorWrapper: React.FC<{ children: any }> = ({ children }: any) => {
    return <ErrorBoundary
        fallbackRender={fallbackRender}
        onReset={() => { }}>
        {children}
    </ErrorBoundary>
}

createRoot(document.getElementById('root')!)
    .render(<>
        <StrictMode>
            <AutoRootCtx Wrapper={ErrorWrapper} />
            <ErrorWrapper>
                <Dev />
            </ErrorWrapper>
            <DevToolContainer
                Component={DataView}
                style={{ left: '20px', bottom: '20px', right: 'unset' }}
            />
        </StrictMode>
    </>)
