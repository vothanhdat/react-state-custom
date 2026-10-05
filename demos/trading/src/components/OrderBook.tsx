import { memo, useMemo, useState } from 'react'
import { shallowEqual } from 'react-state-custom'
import { fmt, fmtTime } from '../lib/format'
import { decimalsOf, roundTo } from '../lib/num'
import type { Market, Order } from '../sim/types'
import { isOpen, useAccount } from '../stores/account'
import { useMarket, useWorkspace } from '../stores/app'
import { useBook, useBookView, useTrades } from '../stores/market'
import { useOrderForm } from '../stores/orderForm'
import { useCommitCounter } from './Perf'

const ROWS = 12

export function OrderBook() {
  const { symbol } = useWorkspace()
  const market = useMarket(symbol)
  return (
    <section className="panel book">
      <div className="panel-head"><span className="panel-title">Order book</span></div>
      {market ? <Ladder key={symbol} market={market} /> : <div className="empty">Loading…</div>}
    </section>
  )
}

/** Prices of the user's open orders, grouped like the ladder rows */
const myPrices = (orders: Record<string, Order | undefined>, symbol: string, grouping: number) => {
  const decimals = decimalsOf(grouping)
  const prices: number[] = []
  for (const o of Object.values(orders)) {
    if (!o || o.symbol !== symbol || o.price === null || !isOpen(o)) continue
    const steps = o.price / grouping
    prices.push(roundTo((o.side === 'buy' ? Math.floor(steps + 1e-9) : Math.ceil(steps - 1e-9)) * grouping, decimals))
  }
  return prices.sort((a, b) => a - b)
}

function Ladder({ market }: { market: Market }) {
  useCommitCounter('order book')
  const { symbol } = market
  const groupings = useMemo(() => [1, 10, 100, 1000].map(m => roundTo(market.tickSize * m, 10)), [market])
  const [grouping, setGrouping] = useState(groupings[1] ?? market.tickSize)
  const { askRows, bidRows, maxTotal, spread, mid, status } = useBookView({ symbol, grouping, depth: ROWS })
  const { resyncs } = useBook({ symbol })
  const { pickPrice } = useOrderForm({ symbol })
  const mine = useAccount(undefined, s => myPrices(s.orders, symbol, grouping), shallowEqual)
  const priceDecimals = decimalsOf(grouping)

  // asks are drawn top-down from the highest, so the best ask sits right above the spread
  const asks = askRows ? [...askRows].reverse() : []
  const pad = (n: number) => Array.from({ length: Math.max(0, ROWS - n) }, (_, i) => <div key={`pad${i}`} className="book-row" />)

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
        {asks.map(r => (
          <BookRow key={r.price} side="ask" price={r.price} size={r.size} total={r.total} maxTotal={maxTotal ?? 1}
            priceDecimals={priceDecimals} sizeDecimals={market.sizeDecimals} mine={mine.includes(r.price)} onPick={pickPrice} />
        ))}
      </div>
      <div className="book-spread">
        <LastTrade symbol={symbol} decimals={market.priceDecimals} />
        <span className="muted">
          spread {fmt(spread, market.priceDecimals)}
          {spread !== undefined && mid ? ` (${((spread / mid) * 10_000).toFixed(1)} bps)` : ''}
        </span>
      </div>
      <div className="book-side">
        {(bidRows ?? []).map(r => (
          <BookRow key={r.price} side="bid" price={r.price} size={r.size} total={r.total} maxTotal={maxTotal ?? 1}
            priceDecimals={priceDecimals} sizeDecimals={market.sizeDecimals} mine={mine.includes(r.price)} onPick={pickPrice} />
        ))}
        {pad(bidRows?.length ?? 0)}
      </div>
    </>
  )
}

function LastTrade({ symbol, decimals }: { symbol: string; decimals: number }) {
  const { lastPrice, direction } = useTrades({ symbol })
  return <b className={`book-last ${direction === 'up' ? 'pos' : direction === 'down' ? 'neg' : ''}`}>{fmt(lastPrice, decimals)} {direction === 'up' ? '↑' : direction === 'down' ? '↓' : ''}</b>
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
  const market = useMarket(symbol)
  return (
    <section className="panel trades">
      <div className="panel-head"><span className="panel-title">Trades</span></div>
      <div className="trade-row book-head"><span>Price</span><span>Size</span><span>Time</span></div>
      {market && <TradeList symbol={symbol} market={market} />}
    </section>
  )
}

function TradeList({ symbol, market }: { symbol: string; market: Market }) {
  useCommitCounter('trades')
  const { trades } = useTrades({ symbol })
  return (
    <div className="scroll">
      {trades?.map(t => (
        <TradeRow key={t.id} side={t.side} price={t.price} size={t.size} ts={t.ts} market={market} />
      ))}
    </div>
  )
}

const TradeRow = memo(function TradeRow({ side, price, size, ts, market }: { side: string; price: number; size: number; ts: number; market: Market }) {
  return (
    <div className="trade-row">
      <span className={`num ${side === 'buy' ? 'pos' : 'neg'}`}>{fmt(price, market.priceDecimals)}</span>
      <span className="num">{fmt(size, market.sizeDecimals)}</span>
      <span className="num muted">{fmtTime(ts)}</span>
    </div>
  )
})
