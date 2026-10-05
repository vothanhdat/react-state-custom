import { memo, useMemo, useState } from 'react'
import { fmt, fmtTime } from '../lib/format'
import { roundTo } from '../lib/num'
import type { Market } from '../sim/types'
import { useLadder, useMarketInfo, useTradeTape } from '../stores/ui/marketViews'
import { useOrderForm } from '../stores/ui/orderForm'
import { useWorkspace } from '../stores/ui/workspace'
import { useCommitCounter } from './Perf'

const ROWS = 12

export function OrderBook() {
  const { symbol } = useWorkspace()
  const market = useMarketInfo(symbol ?? '')
  return (
    <section className="panel book">
      <div className="panel-head"><span className="panel-title">Order book</span></div>
      {market ? <Ladder key={symbol} market={market} /> : <div className="empty">Loading…</div>}
    </section>
  )
}

function Ladder({ market }: { market: Market }) {
  useCommitCounter('order book')
  const { symbol } = market
  const groupings = useMemo(() => [1, 10, 100, 1000].map(m => roundTo(market.tickSize * m, 10)), [market])
  const [grouping, setGrouping] = useState(groupings[1] ?? market.tickSize)
  const {
    askRows, bidRows, maxTotal, spread, spreadBps, status, resyncs, lastPrice, direction, priceDecimals, sizeDecimals,
  } = useLadder({ symbol, grouping, depth: ROWS })
  const { pickPrice } = useOrderForm({ symbol })

  // asks are drawn top-down from the highest, so the best ask sits right above the spread
  const asks = askRows ? [...askRows].reverse() : []
  const pad = (n: number) => Array.from({ length: Math.max(0, ROWS - n) }, (_, i) => <div key={`pad${i}`} className="book-row" />)
  const row = (side: 'bid' | 'ask') => (r: { price: number; size: number; total: number; mine: boolean }) => (
    <BookRow key={r.price} side={side} price={r.price} size={r.size} total={r.total} maxTotal={maxTotal ?? 1}
      priceDecimals={priceDecimals ?? 2} sizeDecimals={sizeDecimals ?? 4} mine={r.mine} onPick={pickPrice} />
  )

  return (
    <>
      <div className="book-tools">
        <select value={grouping} onChange={e => setGrouping(Number(e.target.value))} aria-label="Group levels">
          {groupings.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <span className={`badge badge-${status}`} title="Gaps detected and resynced">{status}{resyncs ? ` · ${resyncs} resyncs` : ''}</span>
      </div>
      <div className="book-row book-head"><span>Price</span><span>Size</span><span>Total</span></div>
      <div className="book-side">
        {pad(asks.length)}
        {asks.map(row('ask'))}
      </div>
      <div className="book-spread">
        <b className={`book-last ${direction === 'up' ? 'pos' : direction === 'down' ? 'neg' : ''}`}>
          {fmt(lastPrice, market.priceDecimals)} {direction === 'up' ? '↑' : direction === 'down' ? '↓' : ''}
        </b>
        <span className="muted">
          spread {fmt(spread, market.priceDecimals)}{spreadBps !== undefined ? ` (${spreadBps.toFixed(1)} bps)` : ''}
        </span>
      </div>
      <div className="book-side">
        {(bidRows ?? []).map(row('bid'))}
        {pad(bidRows?.length ?? 0)}
      </div>
    </>
  )
}

type RowProps = {
  side: 'bid' | 'ask'
  price: number
  size: number
  total: number
  maxTotal: number
  priceDecimals: number
  sizeDecimals: number
  mine: boolean
  onPick: ((price: number, from: 'bid' | 'ask') => void) | undefined
}

const BookRow = memo(function BookRow({ side, price, size, total, maxTotal, priceDecimals, sizeDecimals, mine, onPick }: RowProps) {
  useCommitCounter('book rows')
  return (
    <div className={`book-row ${side} ${mine ? 'mine' : ''}`} onClick={() => onPick?.(price, side)} title={side === 'ask' ? 'Buy at this price' : 'Sell at this price'}>
      <div className="depth-bar" style={{ transform: `scaleX(${Math.min(1, total / maxTotal)})` }} />
      <span className="num price">{fmt(price, priceDecimals)}</span>
      <span key={size} className="num flash">{fmt(size, sizeDecimals)}</span>
      <span className="num muted">{fmt(total, sizeDecimals)}</span>
    </div>
  )
})

// ---------------------------------------------------------------- trades

export function Trades() {
  const { symbol } = useWorkspace()
  return (
    <section className="panel trades">
      <div className="panel-head"><span className="panel-title">Trades</span></div>
      <div className="trade-row book-head"><span>Price</span><span>Size</span><span>Time</span></div>
      {symbol && <TradeList symbol={symbol} />}
    </section>
  )
}

function TradeList({ symbol }: { symbol: string }) {
  useCommitCounter('trades')
  const { trades, priceDecimals, sizeDecimals } = useTradeTape(symbol)
  return (
    <div className="scroll">
      {trades?.map(t => (
        <TradeRow key={t.id} side={t.side} price={t.price} size={t.size} ts={t.ts} priceDecimals={priceDecimals} sizeDecimals={sizeDecimals} />
      ))}
    </div>
  )
}

const TradeRow = memo(function TradeRow({ side, price, size, ts, priceDecimals, sizeDecimals }: { side: string; price: number; size: number; ts: number; priceDecimals: number; sizeDecimals: number }) {
  return (
    <div className="trade-row">
      <span className={`num ${side === 'buy' ? 'pos' : 'neg'}`}>{fmt(price, priceDecimals)}</span>
      <span className="num">{fmt(size, sizeDecimals)}</span>
      <span className="num muted">{fmtTime(ts)}</span>
    </div>
  )
})
