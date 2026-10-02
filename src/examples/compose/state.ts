import { createStore } from '../../index'
import { useState } from 'react'

// A global store with no params.
const useSettingsState = () => {
    const [taxRate, setTaxRate] = useState(0.1)
    const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD')
    return { taxRate, setTaxRate, currency, setCurrency }
}

export const { useStore: useSettingsStore } = createStore('settings', useSettingsState, {
    initialState: { taxRate: 0.1, currency: 'USD' as const },
})

export interface Line {
    id: number
    label: string
    amount: number
}

// A per-invoice store that reads the settings store. Stores compose like hooks:
// when taxRate changes, every invoice store re-runs and its consumers update.
const useInvoiceState = ({ invoiceId }: { invoiceId: string }) => {
    const { taxRate, currency } = useSettingsStore()
    const [lines, setLines] = useState<Line[]>([
        { id: 1, label: 'Design', amount: 400 },
        { id: 2, label: 'Development', amount: 1200 },
    ])

    const addLine = () =>
        setLines(prev => [...prev, { id: Date.now(), label: `Item ${prev.length + 1}`, amount: 100 }])
    const removeLine = (id: number) => setLines(prev => prev.filter(l => l.id !== id))

    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0)
    const tax = subtotal * taxRate
    const format = (n: number) => `${currency === 'USD' ? '$' : '€'}${n.toFixed(2)}`

    return {
        invoiceId,
        lines,
        addLine,
        removeLine,
        subtotal: format(subtotal),
        tax: format(tax),
        total: format(subtotal + tax),
        taxPercent: Math.round(taxRate * 100),
    }
}

export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState, {
    initialState: { lines: [], subtotal: '', tax: '', total: '', taxPercent: 0 },
})
