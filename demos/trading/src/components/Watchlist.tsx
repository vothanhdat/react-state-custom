import { memo, useDeferredValue, useState } from 'react'
import { shallowEqual } from 'react-state-custom'
import { fmt, fmtCompact, fmtPct } from '../lib/format'
import { useFavorites, useMarket, useMarkets, useTicker, useTickers, useWorkspace, type TickerView } from '../stores/app'
import { useCommitCounter } from './Perf'

type Sort = 'volume' | 'change' | 'symbol'

const visibleSymbols = (
  symbols: readonly string[],
  tickers: Record<string, TickerView | undefined>,
  query: string,
  sort: Sort,
  only: readonly string[] | undefined,
) => {
  const q = query.trim().toUpperCase()
  const list = symbols.filter(s => (!only || only.includes(s)) && (!q || s.includes(q)))
  const key = (s: string) => {
    const t = tickers[s]
    if (!t) return 0
    return sort === 'volume' ? t.volume * t.last : t.last / t.open - 1
  }
  return sort === 'symbol' ? list.sort() : list.sort((a, b) => key(b) - key(a))
}

export function Watchlist() {
  useCommitCounter('watchlist')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'favorites'>('all')
  const [sort, setSort] = useState<Sort>('volume')
  // filtering 200 markets on every keystroke is cheap, but re-sorting rows is not: let typing win
  const deferredQuery = useDeferredValue(query)
  const { symbols, error, retry } = useMarkets()
  const { favorites } = useFavorites()
  const only = tab === 'favorites' ? favorites : undefined
  const ids = useTickers(undefined, tickers => visibleSymbols(symbols ?? [], tickers, deferredQuery, sort, only), shallowEqual)

  return (
    <section className="panel watchlist">
      <div className="panel-head">
        <input className="search" placeholder="Search markets" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="tabs small">
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All</button>
        <button className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>★ Favorites</button>
        <select value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort by">
          <option value="volume">Volume</option>
          <option value="change">Change</option>
          <option value="symbol">Name</option>
        </select>
      </div>
      <div className="watch-head"><span>Market</span><span>Last</span><span>24h</span></div>
      <div className="scroll">
        {error && <div className="empty">Markets failed to load. <button onClick={retry}>Retry</button></div>}
        {!symbols && !error && <div className="empty">Loading markets…</div>}
        {symbols && ids.length === 0 && <div className="empty">{tab === 'favorites' ? 'No favorites yet' : 'No match'}</div>}
        {ids.map(symbol => <WatchRow key={symbol} symbol={symbol} />)}
      </div>
    </section>
  )
}

const WatchRow = memo(function WatchRow({ symbol }: { symbol: string }) {
  useCommitCounter('watchlist rows')
  const ticker = useTicker(symbol)
  const decimals = useMarket(symbol)?.priceDecimals ?? 2
  const active = useWorkspace(undefined, s => s.symbol === symbol)
  const favorite = useFavorites(undefined, s => s.favorites.includes(symbol))
  const { setSymbol } = useWorkspace()
  const { toggle } = useFavorites()
  const change = ticker ? ticker.last / ticker.open - 1 : undefined
  return (
    <div className={`watch-row ${active ? 'active' : ''}`} onClick={() => setSymbol?.(symbol)}>
      <span className="watch-name">
        <button
          className={`star ${favorite ? 'on' : ''}`}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={e => { e.stopPropagation(); toggle?.(symbol) }}
        >★</button>
        {symbol.replace('-USD', '')}
      </span>
      {/* the key restarts the flash animation on every new price */}
      <span key={ticker?.last} className={`num ${ticker?.dir === 1 ? 'flash-up' : ticker?.dir === -1 ? 'flash-down' : ''}`}>
        {fmt(ticker?.last, decimals)}
      </span>
      <span className={`num ${change === undefined ? '' : change >= 0 ? 'pos' : 'neg'}`} title={`Volume ${fmtCompact(ticker && ticker.volume * ticker.last)} USD`}>
        {fmtPct(change)}
      </span>
    </div>
  )
})
