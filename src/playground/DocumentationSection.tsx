import { INSTALLATION_CODE, BASIC_USAGE_CODE } from './code-snippets'

export const DocumentationSection = () => {
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
        </>
    )
}
