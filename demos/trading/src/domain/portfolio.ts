import type { Balance, Ticker } from '../sim/types'

export type Holding = {
  asset: string
  free: number
  locked: number
  price: number | undefined
  value: number | undefined
  change: number | undefined
}

export type Valuation = {
  holdings: Holding[]
  /** undefined until every holding has a price: a partial sum would look like a loss */
  equity: number | undefined
  change24h: number | undefined
}

/** Values balances in USD; `tickerOf` gives the USD ticker of an asset */
export const valueHoldings = (balances: Record<string, Balance | undefined>, tickerOf: (asset: string) => Ticker | undefined): Valuation => {
  const holdings: Holding[] = []
  let equity = 0
  let open = 0
  let priced = true
  for (const b of Object.values(balances)) {
    if (!b || b.free + b.locked <= 0) continue
    const usd = b.asset === 'USD'
    const ticker = usd ? undefined : tickerOf(b.asset)
    const price = usd ? 1 : ticker?.last
    const qty = b.free + b.locked
    const value = price === undefined ? undefined : qty * price
    if (value === undefined) priced = false
    equity += value ?? 0
    open += ticker ? qty * ticker.open : usd ? qty : 0
    holdings.push({ asset: b.asset, free: b.free, locked: b.locked, price, value, change: ticker ? ticker.last / ticker.open - 1 : undefined })
  }
  holdings.sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  return {
    holdings,
    equity: priced ? equity : undefined,
    change24h: priced && open > 0 ? equity / open - 1 : undefined,
  }
}
