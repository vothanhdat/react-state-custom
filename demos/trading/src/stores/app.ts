// Small app-wide stores: connection, markets, tickers, workspace, favorites, toasts.

import { useEffect, useMemo, useState } from 'react'
import { createStore } from 'react-state-custom'
import { api, simControls, socket } from '../sim/exchange'
import type { ConnectionStatus, Market, Ticker } from '../sim/types'

/** Ten minutes: for stores that should outlive any screen without holding a resource */
const KEEP = 10 * 60_000

// ---------------------------------------------------------------- connection

export const { useStore: useConnection } = createStore('connection', () => {
  const [status, setStatus] = useState<ConnectionStatus>(socket.status)
  useEffect(() => socket.onStatus(setStatus), [])
  return { status, online: status === 'open', drop: simControls.dropConnection }
}, { initialState: { status: 'connecting', online: false } })

// ---------------------------------------------------------------- markets

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

export const useMarket = (symbol: string) => useMarkets(undefined, s => s.markets?.[symbol])

// ---------------------------------------------------------------- tickers: one top-level key per symbol

/** dir: how the last price moved since the previous update, for the flash in the watchlist */
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

export const useTicker = (symbol: string) => useTickers()[symbol]

// ---------------------------------------------------------------- workspace: what the user is looking at

const readHash = () => decodeURIComponent(location.hash.slice(1)) || undefined

export const INTERVALS = [1, 5, 15, 60] as const

export const { useStore: useWorkspace } = createStore('workspace', () => {
  const [requested, setSymbol] = useState(() => readHash() ?? 'BTC-USD')
  const [chartInterval, setChartInterval] = useState<number>(5)
  const { markets } = useMarkets()
  // a symbol in the URL that does not exist falls back once the markets are known
  const symbol = markets && !markets[requested] ? 'BTC-USD' : requested

  useEffect(() => {
    if (readHash() !== symbol) history.replaceState(null, '', `#${encodeURIComponent(symbol)}`)
  }, [symbol])
  useEffect(() => {
    const onHash = () => { const s = readHash(); if (s) setSymbol(s) }
    addEventListener('hashchange', onHash)
    return () => removeEventListener('hashchange', onHash)
  }, [])

  return { symbol, setSymbol, chartInterval, setChartInterval }
}, { initialState: () => ({ symbol: readHash() ?? 'BTC-USD', chartInterval: 5 }), timeToClean: KEEP })

// ---------------------------------------------------------------- favorites, kept in localStorage

const FAVORITES_KEY = 'trading-demo:favorites'
const loadFavorites = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '')
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return ['BTC-USD', 'ETH-USD', 'SOL-USD']
  }
}

export const { useStore: useFavorites } = createStore('favorites', () => {
  const [favorites, setFavorites] = useState(loadFavorites)
  useEffect(() => {
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)) } catch { /* private mode */ }
  }, [favorites])
  const toggle = (symbol: string) =>
    setFavorites(list => (list.includes(symbol) ? list.filter(s => s !== symbol) : [...list, symbol]))
  return { favorites, toggle }
}, { initialState: () => ({ favorites: loadFavorites() }), timeToClean: KEEP })

// ---------------------------------------------------------------- toasts

export type Toast = { id: number; kind: 'info' | 'success' | 'error'; title: string; body?: string }
let toastId = 1

export const { useStore: useToasts } = createStore('toasts', () => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = (id: number) => setToasts(list => list.filter(t => t.id !== id))
  const push = (toast: Omit<Toast, 'id'>) => {
    const id = toastId++
    setToasts(list => [...list.slice(-3), { ...toast, id }])
    setTimeout(() => dismiss(id), toast.kind === 'error' ? 6000 : 3500)
  }
  return { toasts, push, dismiss }
}, { initialState: { toasts: [] }, timeToClean: KEEP })
