import { useState } from 'react'
import { fmt, fmtCompact, fmtPct, fmtUsd } from '../lib/format'
import { simControls } from '../sim/exchange'
import { useConnection, useMarket, useTicker, useWorkspace } from '../stores/app'
import { useTrades } from '../stores/market'
import { usePortfolio } from '../stores/portfolio'
import { PerfHud, useCommitCounter } from './Perf'

export function Header() {
  const { symbol } = useWorkspace()
  return (
    <header className="header">
      <div className="brand">◆ Terminal</div>
      <SymbolSummary symbol={symbol} />
      <div className="spacer" />
      <Equity />
      <Connection />
      <SimControls />
      <PerfHud />
    </header>
  )
}

function SymbolSummary({ symbol }: { symbol: string }) {
  useCommitCounter('header')
  const market = useMarket(symbol)
  const ticker = useTicker(symbol)
  const decimals = market?.priceDecimals ?? 2
  const change = ticker ? ticker.last / ticker.open - 1 : undefined
  return (
    <div className="summary">
      <div className="summary-symbol">{symbol}</div>
      <LastPrice symbol={symbol} decimals={decimals} />
      <Stat label="24h change" className={change === undefined ? '' : change >= 0 ? 'pos' : 'neg'}>{fmtPct(change)}</Stat>
      <Stat label="24h high">{fmt(ticker?.high, decimals)}</Stat>
      <Stat label="24h low">{fmt(ticker?.low, decimals)}</Stat>
      <Stat label={`24h vol (${market?.base ?? ''})`}>{fmtCompact(ticker?.volume)}</Stat>
    </div>
  )
}

/** The last trade, at trade speed: its own component so nothing else re-renders with it */
function LastPrice({ symbol, decimals }: { symbol: string; decimals: number }) {
  useCommitCounter('last price')
  const { lastPrice, direction } = useTrades({ symbol })
  return <div className={`summary-last ${direction === 'up' ? 'pos' : direction === 'down' ? 'neg' : ''}`}>{fmt(lastPrice, decimals)}</div>
}

function Stat({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${className}`}>{children}</div>
    </div>
  )
}

function Equity() {
  useCommitCounter('equity')
  const { equity, change24h } = usePortfolio()
  return (
    <div className="stat">
      <div className="stat-label">Equity (USD)</div>
      <div className="stat-value">
        {fmtUsd(equity)} <small className={change24h === undefined ? '' : change24h >= 0 ? 'pos' : 'neg'}>{fmtPct(change24h)}</small>
      </div>
    </div>
  )
}

function Connection() {
  const { status } = useConnection()
  return <div className={`pill pill-${status}`}>{status === 'open' ? 'live' : status}</div>
}

const SPEEDS = [1, 5, 20, 50]

function SimControls() {
  // the simulator lives outside React; this panel only mirrors its settings
  const [speed, setSpeed] = useState(simControls.getSpeed)
  const [chaos, setChaos] = useState(simControls.getChaos)
  const { drop, status } = useConnection()
  return (
    <div className="sim">
      <span className="sim-label">feed</span>
      {SPEEDS.map(s => (
        <button key={s} className={speed === s ? 'on' : ''} onClick={() => { simControls.setSpeed(s); setSpeed(s) }}>{s}×</button>
      ))}
      <button
        className={chaos ? 'on warn' : ''}
        title="Drop 1% of book messages so the client has to detect the gap and resync"
        onClick={() => { simControls.setChaos(!chaos); setChaos(!chaos) }}
      >gaps</button>
      <button disabled={status !== 'open'} onClick={drop} title="Drop the connection for two seconds">drop</button>
    </div>
  )
}
