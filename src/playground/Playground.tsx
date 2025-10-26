import sdk from '@stackblitz/sdk'
import { useState, useEffect, useRef } from 'react'


import counterState from "../examples/counter/state.ts?raw"
import counterView from "../examples/counter/view.tsx?raw"
import counterApp from "../examples/counter/app.tsx?raw"
import todoState from "../examples/todo/state.ts?raw"
import todoView from "../examples/todo/view.tsx?raw"
import todoApp from "../examples/todo/app.tsx?raw"
import timerState from "../examples/timer/state.ts?raw"
import timerView from "../examples/timer/view.tsx?raw"
import timerApp from "../examples/timer/app.tsx?raw"
import formState from "../examples/form/state.ts?raw"
import formView from "../examples/form/view.tsx?raw"
import formApp from "../examples/form/app.tsx?raw"
import cartState from "../examples/cart/state.ts?raw"
import cartView from "../examples/cart/view.tsx?raw"
import cartApp from "../examples/cart/app.tsx?raw"

const devToolCode = `

import { ObjectView } from "react-obj-view"
import "react-obj-view/dist/react-obj-view.css"

export const DataView: DataViewComponent = ({ name, value }) => {
  return <ObjectView
    {...{ name, value }}
    expandLevel={1}
  />
}

`


const updateImport = (code: string) => {
    return code.replaceAll(
        `from '../../index'`,
        `from 'react-state-custom'`
    )
}


const injectRootCtx = (code: string) => {
    return [
        `import { AutoRootCtx, DevToolContainer } from 'react-state-custom';`,
        `import 'react-state-custom/dist/react-state-custom.css';`,
        `import { DataView } from './dataview.tsx';`,
        code
            .replaceAll(
                `{/* <AutoRootCtx/> */}`,
                `<AutoRootCtx/>`
            ).replaceAll(
                `{/* <DevToolContainer Component={DataView} /> */}`,
                `<DevToolContainer Component={DataView} style={{ left:"20px", bottom:"10px", right:"unset"}}/>`,
            )
    ].join("\n")
}

const examples = {
    counter: {
        title: 'Counter Example',
        description: 'A simple counter demonstrating basic state management with increment, decrement, and reset operations.',
        state: updateImport(counterState),
        view: updateImport(counterView),
        app: injectRootCtx(updateImport(counterApp)),
    },
    todo: {
        title: 'Todo List Example',
        description: 'Multiple independent todo lists showing how contexts can be scoped by parameters.',
        state: updateImport(todoState),
        view: updateImport(todoView),
        app: injectRootCtx(updateImport(todoApp)),
    },
    form: {
        title: 'Form Example',
        description: 'Form validation example with multiple independent form instances. Shows real-time validation and error handling.',
        state: updateImport(formState),
        view: updateImport(formView),
        app: injectRootCtx(updateImport(formApp)),
    },
    timer: {
        title: 'Timer Example',
        description: 'Multiple independent timers with millisecond precision demonstrating side effects.',
        state: updateImport(timerState),
        view: updateImport(timerView),
        app: injectRootCtx(updateImport(timerApp)),
    },
    cart: {
        title: 'Shopping Cart Example',
        description: 'Shopping cart with product selection and quantity management. Shows how to handle derived state (total, itemCount) and complex state updates.',
        state: updateImport(cartState),
        view: updateImport(cartView),
        app: injectRootCtx(updateImport(cartApp)),
    }
}

export const Playground = () => {
    const [activeExample, setActiveExample] = useState<keyof typeof examples>('counter')
    const example = examples[activeExample]
    const embedRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!embedRef.current) return

        const project = {
            title: example.title,
            description: example.description,
            template: 'node' as const,
            files: {
                '.stackblitzrc': JSON.stringify({
                    installDependencies: false,
                    startCommand: 'pnpm install && pnpm run dev'
                }, null, 2),
                'src/state.ts': example.state,
                'src/view.tsx': example.view,
                'src/App.tsx': example.app,
                'src/dataview.tsx': devToolCode,
                'src/main.tsx': `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)`,
                'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${example.title}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
                'package.json': JSON.stringify({
                    name: 'react-state-custom-example',
                    private: true,
                    version: '0.0.0',
                    type: 'module',
                    scripts: {
                        dev: 'vite',
                        build: 'tsc && vite build',
                        preview: 'vite preview'
                    },
                    dependencies: {
                        'react': '^19.0.0',
                        'react-dom': '^19.0.0',
                        'react-obj-view': '^1.0.4',
                        'react-state-custom': '^1.0.26',
                    },
                    devDependencies: {
                        '@types/react': '^19.0.0',
                        '@types/react-dom': '^19.0.0',
                        '@vitejs/plugin-react': '^4.3.4',
                        'typescript': '^5.6.3',
                        'vite': '^6.0.1',
                    },
                    packageManager: 'pnpm@9.0.0'
                }, null, 2),
                'vite.config.ts': `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
                'tsconfig.json': JSON.stringify({
                    compilerOptions: {
                        target: 'ES2020',
                        useDefineForClassFields: true,
                        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
                        module: 'ESNext',
                        skipLibCheck: true,
                        moduleResolution: 'bundler',
                        allowImportingTsExtensions: true,
                        resolveJsonModule: true,
                        isolatedModules: true,
                        noEmit: true,
                        jsx: 'react-jsx',
                        strict: true,
                        noUnusedLocals: true,
                        noUnusedParameters: true,
                        noFallthroughCasesInSwitch: true
                    },
                    include: ['src']
                }, null, 2)
            },
            settings: {
                compile: {
                    trigger: 'auto',
                    clearConsole: false
                }
            }
        }

        // Clear previous embed
        embedRef.current.innerHTML = ''

        sdk.embedProject(embedRef.current, project, {
            openFile: 'src/App.tsx',
            height: 600,
            view: 'default',
            hideNavigation: false,
            forceEmbedLayout: true
        })
    }, [example, activeExample])

    return (
        <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
            <h1>React State Custom - Interactive Playground</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
                Edit the code below and see the changes in real-time!
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                {(Object.keys(examples) as Array<keyof typeof examples>).map((key) => (
                    <button
                        key={key}
                        onClick={() => setActiveExample(key)}
                        style={{
                            padding: '0.5rem 1rem',
                            background: activeExample === key ? '#007bff' : '#e0e0e0',
                            color: activeExample === key ? 'white' : 'black',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}
                    >
                        {key}
                    </button>
                ))}
            </div>

            <div style={{ marginBottom: '1rem' }}>
                <h2>{example.title}</h2>
                <p style={{ color: '#666', fontSize: '0.875rem' }}>
                    {example.description}
                </p>
            </div>

            <div ref={embedRef} style={{ height: '600px', border: '1px solid #e0e0e0', borderRadius: '4px' }} />

            <div style={{ marginTop: '2rem', padding: '1rem', background: '#f5f5f5', borderRadius: '4px' }}>
                <h3>How it works:</h3>
                <ul style={{ marginLeft: '1.5rem' }}>
                    <li><code>createRootCtx</code> - Creates a context with a custom hook</li>
                    <li><code>createAutoCtx</code> - Automatically manages context lifecycle</li>
                    <li><code>useQuickSubscribe</code> - Subscribes to all context values via proxy</li>
                    <li>Multiple instances share the same context when parameters match</li>
                </ul>
            </div>
        </div>
    )
}
