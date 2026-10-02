import { StateScopeProvider } from '../../index'
import { Counter, Panel } from './view'

export default function App() {
    return (
        <>
            <Panel title="Global scope: both buttons share one store">
                <Counter label="A" />
                <Counter label="B" />
            </Panel>

            <StateScopeProvider>
                <Panel title="Scope 1: its own instance of the same store">
                    <Counter label="A" />
                    <Counter label="B" />
                </Panel>
            </StateScopeProvider>

            <StateScopeProvider>
                <Panel title="Scope 2: another independent instance">
                    <Counter label="A" />
                    <Counter label="B" />
                </Panel>
            </StateScopeProvider>

            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                One store definition, no params. StateScopeProvider gives a subtree its own
                set of store instances, so the same useCounterStore() returns different state
                inside each provider. Useful for widgets, modals or embedding an app twice.
            </p>
        </>
    )
}
