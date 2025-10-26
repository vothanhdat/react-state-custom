import { ErrorBoundary } from "react-error-boundary";
import { ObjectView } from "react-obj-view";
import "react-state-custom/dist/react-state-custom.css"


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

export const ErrorWrapper: React.FC<{ children: any }> = ({ children }: any) => {
    return <ErrorBoundary
        fallbackRender={fallbackRender}
        onReset={() => { }}>
        {children}
    </ErrorBoundary>
}