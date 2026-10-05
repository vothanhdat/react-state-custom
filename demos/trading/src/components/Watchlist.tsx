import { memo, useDeferredValue, useState } from 'react'
import { fmt, fmtCompact, fmtPct } from '../lib/format'
import { useWatchlist, useWatchRow, type WatchSort } from '../stores/ui/watchlist'
import { useCommitCounter } from './Perf'

export function Watchlist() {
  useCommitCounter('watchlist')
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'favorites'>('all')
  const [sort, setSort] = useState<WatchSort>('volume')
  // filtering 200 markets on every keystroke is cheap, but re-sorting rows is not: let typing win
  const deferredQuery = useDeferredValue(query)
  const { ids, loading, error, retry } = useWatchlist({ query: deferredQuery, sort, favoritesOnly: tab === 'favorites' })

  return (
    <section className="panel watchlist">
      <div className="panel-head">
        <input className="search" placeholder="Search markets" value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="tabs small">
        <button className={tab === 'all' ? 'on' : ''} onClick={() => setTab('all')}>All</button>
        <button className={tab === 'favorites' ? 'on' : ''} onClick={() => setTab('favorites')}>★ Favorites</button>
        <select value={sort} onChange={e => setSort(e.target.value as WatchSort)} aria-label="Sort by">
          <option value="volume">Volume</option>
          <option value="change">Change</option>
          <option value="symbol">Name</option>
        </select>
      </div>
      <div className="watch-head"><span>Market</span><span>Last</span><span>24h</span></div>
      <div className="scroll">
        {error && <div className="empty">Markets failed to load. <button onClick={retry}>Retry</button></div>}
        {loading && <div className="empty">Loading markets…</div>}
        {!loading && !error && ids.length === 0 && <div className="empty">{tab === 'favorites' ? 'No favorites yet' : 'No match'}</div>}
        {ids.map(symbol => <WatchRow key={symbol} symbol={symbol} />)}
      </div>
    </section>
  )
}

const WatchRow = memo(function WatchRow({ symbol }: { symbol: string }) {
  useCommitCounter('watchlist rows')
  const { last, dir, change, volumeUsd, decimals, active, favorite, select, toggleFavorite } = useWatchRow(symbol)
  return (
    <div className={`watch-row ${active ? 'active' : ''}`} onClick={select}>
      <span className="watch-name">
        <button
          className={`star ${favorite ? 'on' : ''}`}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          onClick={e => { e.stopPropagation(); toggleFavorite() }}
        >★</button>
        {symbol.replace('-USD', '')}
      </span>
      {/* the key restarts the flash animation on every new price */}
      <span key={last} className={`num ${dir === 1 ? 'flash-up' : dir === -1 ? 'flash-down' : ''}`}>
        {fmt(last, decimals)}
      </span>
      <span className={`num ${change === undefined ? '' : change >= 0 ? 'pos' : 'neg'}`} title={`Volume ${fmtCompact(volumeUsd)} USD`}>
        {fmtPct(change)}
      </span>
    </div>
  )
})
