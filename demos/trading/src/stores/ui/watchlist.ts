// UI: the watchlist. Hooks, not stores: one list and one row component read them.

import { visibleSymbols, type WatchSort } from '../../domain/watchlist'
import { useMarket, useMarkets, useTickers } from '../core/markets'
import { useFavorites, useWorkspace } from './workspace'

export type { WatchSort }

export const useWatchlist = ({ query, sort, favoritesOnly }: { query: string; sort: WatchSort; favoritesOnly: boolean }) => {
  const { symbols, error, retry } = useMarkets()
  const { favorites } = useFavorites()
  const only = favoritesOnly ? favorites : undefined
  // re-runs on every ticker batch, renders the list only when the order changes
  const ids = useTickers(undefined, { select: tickers => visibleSymbols(symbols ?? [], tickers, query, sort, only) })
  return { ids, loading: !symbols && !error, error, retry }
}

export const useWatchRow = (symbol: string) => {
  const ticker = useTickers()[symbol]
  const decimals = useMarket(symbol)?.priceDecimals ?? 2
  const active = useWorkspace(undefined, { select: s => s.symbol === symbol })
  const favorite = useFavorites(undefined, { select: s => !!s.favorites?.includes(symbol) })
  const { setSymbol } = useWorkspace()
  const { toggle } = useFavorites()
  return {
    last: ticker?.last,
    dir: ticker?.dir ?? 0,
    change: ticker ? ticker.last / ticker.open - 1 : undefined,
    volumeUsd: ticker ? ticker.volume * ticker.last : undefined,
    decimals,
    active,
    favorite,
    select: () => setSymbol?.(symbol),
    toggleFavorite: () => toggle?.(symbol),
  }
}
