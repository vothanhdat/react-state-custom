import { Sandpack } from '@codesandbox/sandpack-react'
import { useState } from 'react'

import appCode from "./examples/App.tsx?raw"
import counterCode from "./examples/CounterExample.tsx?raw"
import todoCode from "./examples/TodoExample.tsx?raw"
import timerCode from "./examples/TodoExample.tsx?raw"


const updateImport = (code: string) => {
    return code.replaceAll(
        `from '../index'`,
        `from 'react-state-custom'`
    )
}

const examples = {
    counter: {
        title: 'Counter Example',
        description: 'A simple counter demonstrating basic state management with increment, decrement, and reset operations.',
        code: updateImport(counterCode),
        app: updateImport(appCode)
    },
    todo: {
        title: 'Todo List Example',
        description: 'Multiple independent todo lists showing how contexts can be scoped by parameters.',
        code: updateImport(todoCode),
        app: updateImport(appCode)
    },
    timer: {
        title: 'Timer Example',
        description: 'Multiple independent timers with millisecond precision demonstrating side effects.',
        code: updateImport(timerCode),
        app: updateImport(appCode)
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
                template="react"
                theme="dark"
                files={{
                    '/App.js': example.app,
                    '/Example.js': example.code,
                }}
                options={{
                    showNavigator: false,
                    showTabs: true,
                    showLineNumbers: true,
                    editorHeight: 500,
                }}
                customSetup={{
                    dependencies: {
                        'react': '^19.0.0',
                        'react-dom': '^19.0.0',
                        'react-obj-view': '^1.0.4',
                        'react-state-custom': '^1.0.23',
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
