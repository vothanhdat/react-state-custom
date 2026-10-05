// UI: the account panels. The portfolio is a store (the header and the balances table both read
// it); the rest are hooks over the account store. Commands report failures as toasts here, so the
// account store itself never needs to know about the UI.

import { useMemo } from 'react'
import { createStore, shallowEqual } from 'react-state-custom'
import { closedOrderIds, openOrderIds, type CancelResult } from '../../domain/orders'
import { valueHoldings } from '../../domain/portfolio'
import { useAccount } from '../core/account'
import { useMarket, useTickers } from '../core/markets'
import { useToasts } from './toasts'

// Equity moves with every price tick of a held asset: its readers (the header, the balances table)
// show it four times a second.
export const { useStore: usePortfolio } = createStore('portfolio', () => {
  const { balances } = useAccount()
  const tickers = useTickers()
  // reads one ticker per held asset, so it re-runs when the price of something held changes
  const valuation = balances ? valueHoldings(balances, asset => tickers[`${asset}-USD`]) : undefined
  return { holdings: valuation?.holdings, equity: valuation?.equity, change24h: valuation?.change24h }
}, { schedule: { throttle: 250 } })

export const useAccountSummary = () => {
  const { status } = useAccount()
  const openCount = useAccount(s => openOrderIds(s.orders).length)
  return { status, openCount }
}

/**
 * Order ids for a table, newest first; a new array only when the set changes. Open orders follow
 * every change; the history is a log, rendered when the browser has time (within half a second).
 */
export const useOrderIds = (kind: 'open' | 'history', symbol?: string) =>
  useAccount(s => (kind === 'open' ? openOrderIds(s.orders, symbol) : closedOrderIds(s.orders, symbol, 50)), {
    isEqual: shallowEqual,
    schedule: kind === 'open' ? 'sync' : { idle: 500 },
  })

/** Orders sent but not yet acknowledged; entries keep their identity until they resolve */
export const usePendingOrders = (symbol?: string) =>
  useAccount(s => Object.values(s.pending).filter(p => !!p && (!symbol || p.symbol === symbol)), shallowEqual)

/** The fills log, rendered when the browser has time (within half a second) */
export const useFills = (symbol?: string) => {
  const { fills } = useAccount(undefined, { schedule: { idle: 500 } })
  return useMemo(() => fills.filter(f => !symbol || f.symbol === symbol), [fills, symbol])
}

export const useOrderCommands = () => {
  const { cancelOrder, cancelAll } = useAccount()
  const { push } = useToasts()
  const report = (results: CancelResult[]) => {
    const failed = results.flatMap(r => (r.ok ? [] : [r.error]))
    if (failed.length) push?.({ kind: 'error', title: failed.length > 1 ? `${failed.length} cancels failed` : 'Cancel failed', body: failed[0] })
  }
  return {
    cancel: async (id: string) => {
      const result = await cancelOrder?.(id)
      if (result) report([result])
    },
    cancelAll: async (symbol?: string) => report((await cancelAll?.(symbol)) ?? []),
  }
}

export const useOrderRow = (id: string) => {
  const order = useAccount(s => s.orders[id])
  const cancelling = useAccount(s => !!s.cancelling[id])
  const market = useMarket(order?.symbol ?? '')
  const { cancel } = useOrderCommands()
  return { order, cancelling, priceDecimals: market?.priceDecimals ?? 2, sizeDecimals: market?.sizeDecimals ?? 4, cancel: () => cancel(id) }
}
