import { INVOICES, useInvoiceStore, useSettingsStore, useSummaryStore } from './state'

export const SettingsPanel = () => {
    const { taxRate, setTaxRate, currency, setCurrency } = useSettingsStore()
    return (
        <div className="card">
            <h3>Settings <small>global store</small></h3>
            <label className="row">
                Tax rate {Math.round(taxRate * 100)}%
                <input
                    type="range" min="0" max="30"
                    value={Math.round(taxRate * 100)}
                    onChange={e => setTaxRate?.(Number(e.target.value) / 100)}
                />
            </label>
            <label className="row">
                Currency
                <select value={currency} onChange={e => setCurrency?.(e.target.value as 'USD' | 'EUR')}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                </select>
            </label>
        </div>
    )
}

export const Invoice = ({ invoiceId }: { invoiceId: string }) => {
    const { lines, addLine, removeLine, subtotal, tax, total, taxPercent } = useInvoiceStore({ invoiceId })

    return (
        <div className="card">
            <h3>Invoice <small>{invoiceId}</small></h3>
            <ul className="list">
                {lines.map(line => (
                    <li key={line.id}>
                        <span className="grow">{line.label}</span>
                        <span>{line.amount.toFixed(2)}</span>
                        <button onClick={() => removeLine?.(line.id)}>×</button>
                    </li>
                ))}
            </ul>
            <button onClick={addLine}>Add line</button>
            <p>Subtotal: {subtotal} · Tax ({taxPercent}%): {tax} · <strong>Total: {total}</strong></p>
        </div>
    )
}

export const InvoiceSummary = () => {
    const { lineCount, grandTotal } = useSummaryStore()
    return (
        <div className="card">
            <h3>Summary <small>store reading {INVOICES.length} invoice stores</small></h3>
            <p>{lineCount} lines · <strong>Grand total: {grandTotal}</strong></p>
        </div>
    )
}

export default Invoice
