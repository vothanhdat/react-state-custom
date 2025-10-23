import { Sandpack } from '@codesandbox/sandpack-react'
import { useState } from 'react'


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


            <Sandpack
                template="react-ts"
                theme="light"
                files={{
                    '/state.ts': example.state,
                    '/view.tsx': example.view,
                    '/App.tsx': example.app,
                    '/dataview.tsx': devToolCode,
                }}
                options={{
                    showTabs: true,
                    showLineNumbers: true,
                    editorHeight: 600,
                }}
                customSetup={{
                    dependencies: {
                        'react': '^19.0.0',
                        'react-dom': '^19.0.0',
                        'react-obj-view': '^1.0.4',
                        'react-state-custom': '^1.0.25',
                    },

                }}
            />

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
