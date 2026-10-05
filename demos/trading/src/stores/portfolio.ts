// Balances valued at the live prices. Reads one ticker per held asset, so it re-runs when the
// price of something held changes, not on every ticker batch.

import { createStore } from 'react-state-custom'
import { useAccount } from './account'
import { useTickers } from './app'

export type Holding = {
  asset: string
  free: number
  locked: number
  price: number | undefined
  value: number | undefined
  change: number | undefined
}

const usePortfolioState = () => {
  const { balances } = useAccount()
  const tickers = useTickers()

  const holdings: Holding[] = []
  let equity = 0
  let open = 0
  let priced = true
  for (const b of Object.values(balances ?? {})) {
    if (!b || b.free + b.locked <= 0) continue
    const ticker = b.asset === 'USD' ? undefined : tickers[`${b.asset}-USD`]
    const price = b.asset === 'USD' ? 1 : ticker?.last
    const qty = b.free + b.locked
    const value = price === undefined ? undefined : qty * price
    if (value === undefined) priced = false
    equity += value ?? 0
    open += ticker ? qty * ticker.open : b.asset === 'USD' ? qty : 0
    holdings.push({ asset: b.asset, free: b.free, locked: b.locked, price, value, change: ticker ? ticker.last / ticker.open - 1 : undefined })
  }
  holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  return {
    holdings: balances ? holdings : undefined,
    // undefined until every holding has a price: a partial sum would look like a loss
    equity: balances && priced ? equity : undefined,
    change24h: balances && priced && open > 0 ? equity / open - 1 : undefined,
  }
}

export const { useStore: usePortfolio } = createStore('portfolio', usePortfolioState)
