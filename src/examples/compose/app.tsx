import { Invoice, SettingsPanel } from './view'

// The invoice store calls useSettingsStore() inside its own hook: change the tax rate and both recompute.
export default function App() {
    return (
        <>
            <SettingsPanel />
            <Invoice invoiceId="INV-001" />
            <Invoice invoiceId="INV-002" />
        </>
    )
}
