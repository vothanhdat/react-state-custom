import { memo, useState } from 'react'
import { shallowEqual } from 'react-state-custom'
import { fmt, fmtPct, fmtTime, fmtUsd } from '../lib/format'
import type { Order } from '../sim/types'
import { isOpen, useAccount, useOpenOrderIds } from '../stores/account'
import { useMarket, useWorkspace } from '../stores/app'
import { usePortfolio } from '../stores/portfolio'
import { useCommitCounter } from './Perf'

type Tab = 'open' | 'history' | 'fills' | 'balances'

export function AccountPanel() {
  const [tab, setTab] = useState<Tab>('open')
  const [onlyThis, setOnlyThis] = useState(false)
  const { symbol } = useWorkspace()
  const openCount = useOpenOrderIds().length
  const { status, cancelAll } = useAccount()

  return (
    <section className="panel account">
      <div className="panel-head">
        <div className="tabs">
          <button className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Open orders ({openCount})</button>
          <button className={tab === 'history' ? 'on' : ''} onClick={() => setTab('history')}>History</button>
          <button className={tab === 'fills' ? 'on' : ''} onClick={() => setTab('fills')}>Fills</button>
          <button className={tab === 'balances' ? 'on' : ''} onClick={() => setTab('balances')}>Balances</button>
        </div>
        <span className="spacer" />
        {status !== 'ready' && <span className={`badge badge-${status}`}>{status === 'stale' ? 'offline' : 'syncing'}</span>}
        {(tab === 'open' || tab === 'history' || tab === 'fills') && (
          <label className="check"><input type="checkbox" checked={onlyThis} onChange={e => setOnlyThis(e.target.checked)} /> {symbol} only</label>
        )}
        {tab === 'open' && <button className="link" disabled={!openCount} onClick={() => cancelAll?.(onlyThis ? symbol : undefined)}>Cancel all</button>}
      </div>
      <div className="scroll">
        {tab === 'open' && <OpenOrders symbol={onlyThis ? symbol : undefined} />}
        {tab === 'history' && <History symbol={onlyThis ? symbol : undefined} />}
        {tab === 'fills' && <Fills symbol={onlyThis ? symbol : undefined} />}
        {tab === 'balances' && <Balances />}
      </div>
    </section>
  )
}

const OrderHead = () => (
  <div className="order-row head">
    <span>Time</span><span>Market</span><span>Side</span><span>Type</span><span>Price</span><span>Filled / Size</span><span>Status</span><span />
  </div>
)

function OpenOrders({ symbol }: { symbol?: string }) {
  useCommitCounter('open orders')
  const ids = useOpenOrderIds(symbol)
  // in flight: not yet acknowledged by the engine; the entries keep their identity until they resolve
  const pending = useAccount(undefined, s => Object.values(s.pending).filter(p => !!p && (!symbol || p.symbol === symbol)), shallowEqual)
  if (!ids.length && !pending.length) return <div className="empty">No open orders</div>
  return (
    <>
      <OrderHead />
      {pending.map(p => p && (
        <div key={p.clientId} className="order-row pending">
          <span className="num muted">{fmtTime(p.createdAt)}</span>
          <span>{p.symbol}</span>
          <span className={p.side === 'buy' ? 'pos' : 'neg'}>{p.side}</span>
          <span>{p.type}</span>
          <span className="num">{p.price ?? 'market'}</span>
          <span className="num">0 / {p.size}</span>
          <span className="muted">sending…</span>
          <span />
        </div>
      ))}
      {ids.map(id => <OrderRow key={id} id={id} />)}
    </>
  )
}

const OrderRow = memo(function OrderRow({ id }: { id: string }) {
  useCommitCounter('order rows')
  const order = useAccount(undefined, s => s.orders[id])
  const cancelling = useAccount(undefined, s => !!s.cancelling[id])
  const { cancelOrder } = useAccount()
  const market = useMarket(order?.symbol ?? '')
  // the list that gave this id can be one commit behind the order itself
  if (!order) return null
  const pd = market?.priceDecimals ?? 2
  const sd = market?.sizeDecimals ?? 4
  return (
    <div className="order-row">
      <span className="num muted">{fmtTime(order.createdAt)}</span>
      <span>{order.symbol}</span>
      <span className={order.side === 'buy' ? 'pos' : 'neg'}>{order.side}</span>
      <span>{order.type}</span>
      <span className="num">{order.price === null ? 'market' : fmt(order.price, pd)}</span>
      <span className="num">
        <span className="fill-bar" style={{ '--filled': order.filled / order.size } as React.CSSProperties} />
        {fmt(order.filled, sd)} / {fmt(order.size, sd)}
      </span>
      <span>{order.status.replace('_', ' ')}</span>
      <span>
        {isOpen(order) && (
          <button className="link" disabled={cancelling} onClick={() => cancelOrder?.(id)}>{cancelling ? 'cancelling…' : 'cancel'}</button>
        )}
      </span>
    </div>
  )
})

function History({ symbol }: { symbol?: string }) {
  useCommitCounter('history')
  const ids = useAccount(undefined, s =>
    Object.values(s.orders)
      .filter((o): o is Order => !!o && !isOpen(o) && (!symbol || o.symbol === symbol))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50)
      .map(o => o.id),
  shallowEqual)
  if (!ids.length) return <div className="empty">No closed orders yet</div>
  return <><OrderHead />{ids.map(id => <OrderRow key={id} id={id} />)}</>
}

function Fills({ symbol }: { symbol?: string }) {
  const { fills } = useAccount()
  const list = fills.filter(f => !symbol || f.symbol === symbol)
  if (!list.length) return <div className="empty">No fills yet</div>
  return (
    <>
      <div className="fill-row head"><span>Time</span><span>Market</span><span>Side</span><span>Price</span><span>Size</span><span>Fee (USD)</span><span>Role</span></div>
      {list.map(f => (
        <div key={f.id} className="fill-row">
          <span className="num muted">{fmtTime(f.ts)}</span>
          <span>{f.symbol}</span>
          <span className={f.side === 'buy' ? 'pos' : 'neg'}>{f.side}</span>
          <span className="num">{f.price}</span>
          <span className="num">{f.size}</span>
          <span className="num">{fmtUsd(f.fee)}</span>
          <span className="muted">{f.liquidity}</span>
        </div>
      ))}
    </>
  )
}

function Balances() {
  useCommitCounter('balances')
  const { holdings, equity } = usePortfolio()
  if (!holdings) return <div className="empty">Loading balances…</div>
  return (
    <>
      <div className="balance-row head"><span>Asset</span><span>Available</span><span>In orders</span><span>Price</span><span>24h</span><span>Value (USD)</span><span>Share</span></div>
      {holdings.map(h => (
        <div key={h.asset} className="balance-row">
          <span><b>{h.asset}</b></span>
          <span className="num">{fmt(h.free, h.asset === 'USD' ? 2 : 6)}</span>
          <span className="num muted">{fmt(h.locked, h.asset === 'USD' ? 2 : 6)}</span>
          <span className="num">{h.asset === 'USD' ? '' : fmtUsd(h.price)}</span>
          <span className={`num ${h.change === undefined ? '' : h.change >= 0 ? 'pos' : 'neg'}`}>{h.asset === 'USD' ? '' : fmtPct(h.change)}</span>
          <span className="num">{fmtUsd(h.value)}</span>
          <span className="share"><span style={{ width: `${equity && h.value ? (h.value / equity) * 100 : 0}%` }} /></span>
        </div>
      ))}
    </>
  )
}
