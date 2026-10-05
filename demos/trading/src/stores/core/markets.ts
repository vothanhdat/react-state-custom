// Core: reference data (markets) and the all-markets ticker stream, one top-level key per symbol.

import { useEffect, useMemo, useState } from 'react'
import { createStore } from 'react-state-custom'
import { api, socket } from '../../sim/exchange'
import type { Market, Ticker } from '../../sim/types'

const KEEP = 10 * 60_000

export const { useStore: useMarkets } = createStore('markets', () => {
  const [markets, setMarkets] = useState<Record<string, Market | undefined>>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.getMarkets().then(
      list => { if (!cancelled) setMarkets(Object.fromEntries(list.map(m => [m.symbol, m]))) },
      (e: Error) => { if (!cancelled) setError(e.message) },
    )
    return () => { cancelled = true }
  }, [attempt])

  const symbols = useMemo(() => (markets ? Object.keys(markets) : undefined), [markets])
  return { markets, symbols, error, retry: () => { setError(undefined); setAttempt(a => a + 1) } }
}, { timeToClean: KEEP })

/** One market's rules; re-renders only when that market changes */
export const useMarket = (symbol: string) => useMarkets(undefined, s => s.markets?.[symbol])

/** dir: how the last price moved since the previous update */
export type TickerView = Ticker & { dir: 1 | 0 | -1 }

export const { useStore: useTickers } = createStore('tickers', () => {
  const [tickers, setTickers] = useState<Record<string, TickerView | undefined>>({})
  useEffect(() => socket.subscribe('tickers', '', batch => {
    setTickers(prev => {
      const next = { ...prev }
      for (const t of batch) {
        const before = prev[t.symbol]?.last
        next[t.symbol] = { ...t, dir: before === undefined || before === t.last ? 0 : t.last > before ? 1 : -1 }
      }
      return next
    })
  }), [])
  return tickers
}, { timeToClean: KEEP })
