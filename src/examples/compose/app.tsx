import { INVOICES } from './state'
import { Invoice, InvoiceSummary, SettingsPanel } from './view'

// Stores compose like hooks: settings -> invoice -> summary. Move the tax slider or add a line
// and every level recomputes.
export default function App() {
    return (
        <>
            <SettingsPanel />
            {INVOICES.map(id => <Invoice key={id} invoiceId={id} />)}
            <InvoiceSummary />
        </>
    )
}
