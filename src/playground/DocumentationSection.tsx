import { useState, useEffect } from 'react'
import { INSTALLATION_CODE, CODE_EXAMPLES, CodeExample } from './code-snippets'

export const DocumentationSection = () => {
    const [activeTab, setActiveTab] = useState<string>('basic')
    const activeExample = CODE_EXAMPLES.find(ex => ex.id === activeTab) ?? CODE_EXAMPLES[0]!

    // Re-highlight code when tab changes
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).Prism) {
            setTimeout(() => {
                (window as any).Prism.highlightAll()
            }, 50)
        }
    }, [activeTab])

    return (
        <>
            <div className="installation-section">
                <h3>Quick Start</h3>
                <p style={{ color: 'rgba(255, 255, 255, 0.9)', marginBottom: '1rem' }}>
                    Install the package and start building:
                </p>
                <div className="code-block">
                    <pre><code className="language-bash">{INSTALLATION_CODE}</code></pre>
                </div>

                <h3 style={{ marginTop: '2rem' }}>Usage Examples</h3>
                <div className="code-tabs">
                    {CODE_EXAMPLES.map((example) => (
                        <button
                            key={example.id}
                            onClick={() => setActiveTab(example.id)}
                            className={`code-tab ${activeTab === example.id ? 'active' : ''}`}
                        >
                            {example.label}
                        </button>
                    ))}
                </div>
                <div className="code-block">
                    <pre><code className="language-typescript">{activeExample.code}</code></pre>
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
                    <li><code>createStore(name, useFn, options?)</code> - Turns any custom hook into a shared store; returns <code>useStore</code> and <code>storeRef</code></li>
                    <li><code>useStore(params?, options?)</code> - Reads a store; re-renders only for the keys you access during render, or for <code>{'{ select }'}</code></li>
                    <li><code>storeRef(params?)</code> - One instance outside React: <code>get()</code>, <code>subscribe()</code>, <code>retain()</code></li>
                    <li><code>useMultipleStore(refs, options?)</code> - Several instances in one call, for a list of any length</li>
                    <li><code>AutoRootCtx</code> - Mount once; runs every store hook in a headless component and cleans up unused stores</li>
                    <li>Every key is <code>undefined</code> until the store has run once: default at the read (<code>count ?? 0</code>)</li>
                    <li>Same store, same params = one shared instance; different params = independent instances</li>
                </ul>
            </div>
        </>
    )
}
