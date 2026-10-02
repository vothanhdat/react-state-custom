import { useInvoiceStore, useSettingsStore } from './state'

const box = { padding: '1rem', border: '1px solid #ccc', marginBottom: '1rem' }

export const SettingsPanel = () => {
    const { taxRate, setTaxRate, currency, setCurrency } = useSettingsStore()
    return (
        <div style={{ ...box, background: '#f7f7f7' }}>
            <h3>Settings (global store)</h3>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                Tax rate: {Math.round(taxRate * 100)}%{' '}
                <input
                    type="range" min="0" max="30" step="1"
                    value={Math.round(taxRate * 100)}
                    onChange={e => setTaxRate?.(Number(e.target.value) / 100)}
                />
            </label>
            <label>
                Currency:{' '}
                <select value={currency} onChange={e => setCurrency?.(e.target.value as 'USD' | 'EUR')}>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                </select>
            </label>
        </div>
    )
}

export const Invoice = ({ invoiceId }: { invoiceId: string }) => {
    const { lines, addLine, removeLine, subtotal, tax, total, taxPercent } =
        useInvoiceStore({ invoiceId })

    return (
        <div style={box}>
            <h3>Invoice {invoiceId}</h3>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {lines.map(line => (
                    <li key={line.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ flex: 1 }}>{line.label}</span>
                        <span>{line.amount.toFixed(2)}</span>
                        <button onClick={() => removeLine?.(line.id)}>×</button>
                    </li>
                ))}
            </ul>
            <button onClick={addLine}>Add line</button>
            <div style={{ borderTop: '1px solid #ccc', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                <div>Subtotal: {subtotal}</div>
                <div>Tax ({taxPercent}%): {tax}</div>
                <div style={{ fontWeight: 'bold' }}>Total: {total}</div>
            </div>
        </div>
    )
}

export default Invoice
