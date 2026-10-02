import { Invoice, SettingsPanel } from './view'

export default function App() {
    return (
        <>
            <SettingsPanel />
            <Invoice invoiceId="INV-001" />
            <Invoice invoiceId="INV-002" />
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
                The invoice store calls useSettingsStore() inside its own hook. Change the tax
                rate or currency above and both invoices recompute; each invoice still keeps
                its own lines.
            </p>
        </>
    )
}
