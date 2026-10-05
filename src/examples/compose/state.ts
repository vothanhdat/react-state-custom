import { createStore } from '../../index'
import { useState } from 'react'

// A global store with no params.
const useSettingsState = () => {
    const [taxRate, setTaxRate] = useState(0.1)
    const [currency, setCurrency] = useState<'USD' | 'EUR'>('USD')
    return { taxRate, setTaxRate, currency, setCurrency }
}

export const { useStore: useSettingsStore } = createStore('settings', useSettingsState)

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
    // the settings store starts with this one: its values arrive one render later
    const { taxRate = 0, currency = 'USD' } = useSettingsStore()
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

export const { useStore: useInvoiceStore } = createStore('invoice', useInvoiceState)

// A third store that reads the two invoice stores (and settings for the currency).
// The chain is settings -> invoice -> summary: one slider move updates all three levels.
const useSummaryState = () => {
    const { currency = 'USD' } = useSettingsStore()
    const first = useInvoiceStore({ invoiceId: INVOICES[0] })
    const second = useInvoiceStore({ invoiceId: INVOICES[1] })

    return {
        lineCount: (first.lines?.length ?? 0) + (second.lines?.length ?? 0),
        grandTotal: format(currency, (first.totalAmount ?? 0) + (second.totalAmount ?? 0)),
    }
}

export const { useStore: useSummaryStore } = createStore('invoice-summary', useSummaryState)
