import type { Ticker } from '../sim/types'

export type WatchSort = 'volume' | 'change' | 'symbol'

/** The markets to list: filtered by text and an optional allow-list, sorted by 24h volume (USD), change or name */
export const visibleSymbols = (
  symbols: readonly string[],
  tickers: Record<string, Ticker | undefined>,
  query: string,
  sort: WatchSort,
  only: readonly string[] | undefined,
) => {
  const q = query.trim().toUpperCase()
  const list = symbols.filter(s => (!only || only.includes(s)) && (!q || s.includes(q)))
  if (sort === 'symbol') return list.sort()
  const key = (s: string) => {
    const t = tickers[s]
    if (!t) return 0
    return sort === 'volume' ? t.volume * t.last : t.last / t.open - 1
  }
  return list.sort((a, b) => key(b) - key(a))
}
