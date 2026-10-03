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

export const INVOICES = ['INV-001', 'INV-002'] as const

const format = (currency: 'USD' | 'EUR', n: number) => `${currency === 'USD' ? '$' : '€'}${n.toFixed(2)}`

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

    return {
        invoiceId,
        lines,
        addLine,
        removeLine,
        subtotal: format(currency, subtotal),
        tax: format(currency, tax),
        total: format(currency, subtotal + tax),
        totalAmount: subtotal + tax,
        taxPercent: Math.round(taxRate * 100),
    }
}

export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState, {
    initialState: { lines: [], subtotal: '', tax: '', total: '', totalAmount: 0, taxPercent: 0 },
})

// A third store that reads the two invoice stores (and settings for the currency).
// The chain is settings -> invoice -> summary: one slider move updates all three levels.
const useSummaryState = () => {
    const { currency } = useSettingsStore()
    const first = useInvoiceStore({ invoiceId: INVOICES[0] })
    const second = useInvoiceStore({ invoiceId: INVOICES[1] })

    return {
        lineCount: first.lines.length + second.lines.length,
        grandTotal: format(currency, first.totalAmount + second.totalAmount),
    }
}

export const { useStore: useSummaryStore } = createStore('invoice-summary', useSummaryState, {
    initialState: { lineCount: 0, grandTotal: '' },
})
