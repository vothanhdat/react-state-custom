import sdk, { VM } from '@stackblitz/sdk'
import { useState, useEffect, useId } from 'react'
import './playground.css'

// Example files
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

// Shared project files
import dataviewCode from "./files/dataview.tsx?raw"
import mainCode from "./files/main.tsx?raw"
import indexHtmlTemplate from "./files/index.html?raw"
import packageJsonCode from "./files/package.json?raw"
import viteConfigCode from "./files/vite.config.ts?raw"
import tsconfigCode from "./files/tsconfig.json?raw"
import stackblitzrcCode from "./files/stackblitzrc.json?raw"


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

// Installation code snippet
const INSTALLATION_CODE = `# Install via npm
npm install react-state-custom

# Or with yarn
yarn add react-state-custom`

// Basic usage code snippet
const BASIC_USAGE_CODE = `import { createRootCtx } from 'react-state-custom';
import { useState } from 'react';

// Create a root context with your custom hook
const useCounterCtx = createRootCtx('counter', () => {
  const [count, setCount] = useState(0);
  return { count, setCount };
});

// Use the context in your components
function Counter() {
  const { count, setCount } = useCounterCtx.useCtxState();
  return (
    <div>
      <h1>{count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

// Mount the Root component in your app
function App() {
  return (
    <>
      <useCounterCtx.Root />
      <Counter />
    </>
  );
}`

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
    const elId = useId()
    const [activeExample, setActiveExample] = useState<keyof typeof examples>('counter')
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const example = examples[activeExample]
    const [vm, setVM] = useState<VM | null>(null)

    // Highlight code blocks on mount and when content changes
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).Prism) {
            (window as any).Prism.highlightAll()
        }
    }, [])

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
                'src/dataview.tsx': dataviewCode,
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
                theme: "default",
            }).then(e => {
                setVM(e)
                setIsLoading(false)
            }).catch((error) => {
                console.error('Failed to embed StackBlitz:', error)
                setError('Failed to load interactive playground')
                setIsLoading(false)
            })
        }, 100)

        // Cleanup function is intentionally not included as StackBlitz VM should persist
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
        <div className="playground-container">
            <header className="playground-header">
                <h1 className="playground-title">React State Custom</h1>
                <p className="playground-subtitle">
                    A hook-first state management library for React 19
                </p>

                <div className="playground-links">
                    <a
                        href="https://github.com/vothanhdat/react-state-custom"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="playground-link"
                    >
                        <svg viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                        </svg>
                        GitHub
                    </a>
                    <a
                        href="https://www.npmjs.com/package/react-state-custom"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="playground-link"
                    >
                        <svg viewBox="0 0 16 16" fill="currentColor">
                            <path d="M0 0v16h16V0H0zm13 13H8v-2H5v2H3V3h10v10z" />
                        </svg>
                        NPM Package
                    </a>
                    <a
                        href="https://github.com/vothanhdat/react-state-custom/blob/master/API_DOCUMENTATION.md"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="playground-link"
                    >
                        <svg viewBox="0 0 16 16" fill="currentColor">
                            <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3.797a1.5 1.5 0 0 1 1.06.44l.707.707A.5.5 0 0 0 8.418 2.5H14.5A1.5 1.5 0 0 1 16 4v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 11V4a1.5 1.5 0 0 1 1-1.41V2.5zm1 .5v8.5h12V4H2z" />
                        </svg>
                        Documentation
                    </a>
                </div>
            </header>

            <div className="content-card">
                <div className="example-selector">
                    {(Object.keys(examples) as Array<keyof typeof examples>).map((key) => (
                        <button
                            key={key}
                            onClick={() => setActiveExample(key)}
                            className={`example-button ${activeExample === key ? 'active' : ''}`}
                        >
                            {key}
                        </button>
                    ))}
                </div>

                <div className="example-info">
                    <h2 className="example-title">{example.title}</h2>
                    <p className="example-description">
                        {example.description}
                    </p>
                </div>

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
            </div>

            <div className="installation-section">
                <h3>Quick Start</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '1rem' }}>
                    Install the package and start building:
                </p>
                <div className="code-block">
                    <pre><code className="language-bash">{INSTALLATION_CODE}</code></pre>
                </div>

                <h3 style={{ marginTop: '2rem' }}>Basic Usage</h3>
                <div className="code-block">
                    <pre><code className="language-typescript">{BASIC_USAGE_CODE}</code></pre>
                </div>

                <div className="feature-grid">
                    <div className="feature-card">
                        <h4>🎯 Type-Safe</h4>
                        <p>Full TypeScript support with automatic type inference</p>
                    </div>
                    <div className="feature-card">
                        <h4>⚡ Performance</h4>
                        <p>Fine-grained reactivity with selective subscriptions</p>
                    </div>
                    <div className="feature-card">
                        <h4>🔧 Flexible</h4>
                        <p>Works with any custom React hook</p>
                    </div>
                    <div className="feature-card">
                        <h4>🎨 Developer Tools</h4>
                        <p>Built-in DevTools for debugging state</p>
                    </div>
                </div>
            </div>

            <div className="info-section">
                <h3>Key Concepts</h3>
                <ul>
                    <li><code>createRootCtx</code> - Creates a context from any custom hook</li>
                    <li><code>createAutoCtx</code> - Automatically manages context lifecycle based on usage</li>
                    <li><code>useQuickSubscribe</code> - Subscribe to context values via a convenient proxy</li>
                    <li><code>useDataSource</code> / <code>useDataSourceMultiple</code> - Publish data to contexts</li>
                    <li><code>useDataSubscribe</code> / <code>useDataSubscribeMultiple</code> - Subscribe to specific keys</li>
                    <li>Multiple component instances automatically share state when parameters match</li>
                </ul>
            </div>
        </div>
    )
}
