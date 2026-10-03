import { StateScopeProvider } from '../../index'
import { Counter, Panel } from './view'

// One store definition. Each StateScopeProvider gets its own instance of it.
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
        </>
    )
}
