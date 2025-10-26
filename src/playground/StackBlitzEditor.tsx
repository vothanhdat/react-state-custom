import sdk, { VM } from '@stackblitz/sdk'
import { useEffect, useId, useState } from 'react'
import { Example } from './examples'

// Shared project files
import devToolCode from "./files/src/dev-tool.tsx?raw"
import errorWrapperCode from "./files/src/error-wrapper.tsx?raw"
import mainCode from "./files/src/main.tsx?raw"
import examplesCss from "../examples/examples.css?raw"
import indexHtmlTemplate from "./files/index.html?raw"
import packageJsonCode from "./files/package.json?raw"
import viteConfigCode from "./files/vite.config.ts?raw"
import tsconfigCode from "./files/tsconfig.json?raw"
import stackblitzrcCode from "./files/stackblitzrc.json?raw"

interface StackBlitzEditorProps {
    example: Example
}

export const StackBlitzEditor = ({ example }: StackBlitzEditorProps) => {
    const elId = useId()
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [vm, setVM] = useState<VM | null>(null)

    // Initialize StackBlitz once
    useEffect(() => {
        setIsLoading(true)
        setError(null)

        const project = {
            title: "",
            description: "",
            template: 'node' as const,
            files: {
                '.stackblitzrc': stackblitzrcCode,
                'src/state.ts': example.state,
                'src/view.tsx': example.view,
                'src/App.tsx': example.app,
                'examples.css': examplesCss,
                'src/dev-tool.tsx': devToolCode,
                'src/error-wrapper.tsx': errorWrapperCode,
                'src/main.tsx': mainCode,
                'index.html': indexHtmlTemplate.replace('{{TITLE}}', example.title),
                'package.json': packageJsonCode,
                'vite.config.ts': viteConfigCode,
                'tsconfig.json': tsconfigCode,
            },
            settings: {
                compile: {
                    trigger: 'auto',
                    clearConsole: false,
                }
            }
        }

        // Small delay to ensure DOM is ready
        setTimeout(() => {
            sdk.embedProject(elId, project, {
                openFile: 'src/App.tsx',
                height: 600,
                view: 'default',
                hideNavigation: false,
                forceEmbedLayout: true,
                theme: "light",
            }).then(e => {
                setVM(e)
                setIsLoading(false)
            }).catch((error) => {
                console.error('Failed to embed StackBlitz:', error)
                setError('Failed to load interactive playground')
                setIsLoading(false)
            })
        }, 100)

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [elId])

    // Update files when example changes
    useEffect(() => {
        if (vm && example) {
            setIsLoading(true)
            setError(null)
            vm.applyFsDiff({
                destroy: [],
                create: {
                    'src/state.ts': example.state,
                    'src/view.tsx': example.view,
                    'src/App.tsx': example.app,
                }
            }).then(() => {
                vm.editor.openFile(['src/view.tsx'])
                setIsLoading(false)
            }).catch((error) => {
                console.error('Failed to update example:', error)
                setError('Failed to update example')
                setIsLoading(false)
            })
        }
    }, [vm, example])

    return (
        <div className="stackblitz-container">
            {isLoading && (
                <div className="loading-skeleton">
                    <div className="loading-spinner"></div>
                    <div className="loading-text">Loading interactive playground...</div>
                </div>
            )}
            {error && (
                <div className="loading-skeleton" style={{ background: '#fee' }}>
                    <div style={{ color: '#c00', fontSize: '1rem', fontWeight: 500 }}>
                        ⚠️ {error}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                        Please try refreshing the page
                    </div>
                </div>
            )}
            <div>
                <div id={elId} className="stackblitz-wrapper" key="stackblitz-wrapper" />
            </div>
        </div>
    )
}
