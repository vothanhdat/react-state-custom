// UI: what the user is looking at, and their preferences.

import { useEffect, useState } from 'react'
import { createStore } from 'react-state-custom'
import { useMarkets } from '../core/markets'

const KEEP = 10 * 60_000
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
}, { timeToClean: KEEP })

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
}, { timeToClean: KEEP })
