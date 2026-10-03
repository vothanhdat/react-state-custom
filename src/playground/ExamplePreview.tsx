import sdk from '@stackblitz/sdk'
import { useEffect, useRef, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { AutoRootCtx, StateScopeProvider } from '../index'
import '../examples/examples.css'
import { DevToolContainer } from '../dev-tool'
import { ObjectDataView } from '../dev-tool/obj-view'
import { Example, ExampleKey } from './examples'

// Shared StackBlitz project files
import devToolCode from './files/src/dev-tool.tsx?raw'
import examplesCss from '../examples/examples.css?raw'
import errorWrapperCode from './files/src/error-wrapper.tsx?raw'
import mainCode from './files/src/main.tsx?raw'
import indexHtmlTemplate from './files/index.html?raw'
import packageJsonCode from './files/package.json?raw'
import viteConfigCode from './files/vite.config.ts?raw'
import tsconfigCode from './files/tsconfig.json?raw'
import stackblitzrcCode from './files/stackblitzrc.json?raw'

const FILES = [
    { name: 'state.ts', pick: (e: Example) => e.state },
    { name: 'view.tsx', pick: (e: Example) => e.view },
    { name: 'App.tsx', pick: (e: Example) => e.app },
] as const

// StackBlitz embeds (WebContainers) refuse to run inside pages that are not
// cross-origin isolated, and their own relay frame is then blocked under COEP,
// so the playground renders examples natively and opens StackBlitz in a new tab.
const openInStackBlitz = (example: Example) =>
    sdk.openProject(
        {
            title: `react-state-custom: ${example.title}`,
            description: example.description,
            template: 'node',
            files: {
                '.stackblitzrc': stackblitzrcCode,
                'src/state.ts': example.state,
                'src/view.tsx': example.view,
                'src/App.tsx': example.app,
                'src/dev-tool.tsx': devToolCode,
                'src/examples.css': examplesCss,
                'src/error-wrapper.tsx': errorWrapperCode,
                'src/main.tsx': mainCode,
                'index.html': indexHtmlTemplate.replace('{{TITLE}}', example.title),
                'package.json': packageJsonCode,
                'vite.config.ts': viteConfigCode,
                'tsconfig.json': tsconfigCode,
            },
        },
        { newWindow: true, openFile: 'src/state.ts,src/view.tsx' }
    )

const Scope = ({ global, children }: { global?: boolean; children: React.ReactNode }) =>
    global ? <><AutoRootCtx />{children}</> : <StateScopeProvider>{children}</StateScopeProvider>

const PreviewError = ({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) => (
    <div role="alert" className="preview-error">
        <strong>The example threw:</strong>
        <pre>{error.message}</pre>
        <button onClick={resetErrorBoundary}>Try again</button>
    </div>
)

interface ExamplePreviewProps {
    exampleKey: ExampleKey
    example: Example
    devTools: boolean
}

export const ExamplePreview = ({ exampleKey, example, devTools }: ExamplePreviewProps) => {
    const [file, setFile] = useState<(typeof FILES)[number]['name']>('state.ts')
    const [runId, setRunId] = useState(0)
    const codeRef = useRef<HTMLElement>(null)
    const code = FILES.find(f => f.name === file)!.pick(example)

    useEffect(() => {
        const Prism = (window as any).Prism
        if (Prism && codeRef.current) Prism.highlightElement(codeRef.current)
    }, [code])

    const { App } = example

    return (
        <div className="preview-layout">
            <div className="preview-code">
                <div className="preview-toolbar">
                    <div className="code-tabs">
                        {FILES.map(f => (
                            <button
                                key={f.name}
                                className={`code-tab ${file === f.name ? 'active' : ''}`}
                                onClick={() => setFile(f.name)}
                            >
                                {f.name}
                            </button>
                        ))}
                    </div>
                    <button className="toolbar-button" onClick={() => openInStackBlitz(example)}>
                        Edit on StackBlitz ↗
                    </button>
                </div>
                <div className="code-block preview-code-block">
                    <pre><code ref={codeRef} className="language-typescript">{code}</code></pre>
                </div>
            </div>

            <div className="preview-live">
                <div className="preview-toolbar">
                    <span className="preview-label">Live preview</span>
                    <button className="toolbar-button" onClick={() => setRunId(n => n + 1)}>
                        Reset state
                    </button>
                </div>
                {/* Each example (and each reset) gets its own set of stores: an isolated scope, or a
                    fresh global root for examples that use getStore(). */}
                <Scope key={`${exampleKey}-${runId}`} global={example.global}>
                    <ErrorBoundary FallbackComponent={PreviewError}>
                        <div className="preview-canvas">
                            <App />
                        </div>
                    </ErrorBoundary>
                    {devTools && (
                        <DevToolContainer Component={ObjectDataView} className="preview-devtool-button">
                            Inspect stores
                        </DevToolContainer>
                    )}
                </Scope>
            </div>
        </div>
    )
}
